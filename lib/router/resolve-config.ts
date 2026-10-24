import { getHotspotById } from "@/lib/repositories/hotspots";
import { getRouterById } from "@/lib/repositories/routers";
import {
  getMikroTikConfigFromEnv,
  type MikroTikConfig,
} from "@/lib/router/mikrotik-rest";
import type { Router } from "@/lib/types";

function configFromRouter(router: Router): MikroTikConfig | null {
  if (router.adapterType !== "mikrotik") return null;
  if (!router.host?.trim() || !router.username?.trim()) return null;
  const port = router.port ?? 80;
  return {
    host: router.host.trim(),
    user: router.username.trim(),
    password: router.passwordStored ?? "",
    port,
    secure: port === 443,
  };
}

/**
 * Prefer the hotspot-linked MikroTik credentials.
 * Only fall back to MIKROTIK_* env when the hotspot has no linked router —
 * never when a routerId is set (avoids unlocking site A's router for site B).
 */
export async function resolveMikroTikConfigForHotspot(
  hotspotId: string,
): Promise<{
  config: MikroTikConfig | null;
  source: "router" | "env" | "none";
  router: Router | null;
}> {
  const hotspot = await getHotspotById(hotspotId);
  let router: Router | null = null;
  if (hotspot?.routerId) {
    router = await getRouterById(hotspot.routerId);
  }

  const fromRouter = router ? configFromRouter(router) : null;
  if (fromRouter) {
    return { config: fromRouter, source: "router", router };
  }

  // Linked but incomplete credentials → do not guess via global env.
  if (hotspot?.routerId) {
    return { config: null, source: "none", router };
  }

  const fromEnv = getMikroTikConfigFromEnv();
  if (fromEnv) {
    return { config: fromEnv, source: "env", router };
  }

  return { config: null, source: "none", router };
}
