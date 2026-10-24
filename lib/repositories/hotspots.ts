import * as sb from "@/lib/repositories/hotspots-supabase";
import {
  getRouterById,
  toPublicRouter,
  updateRouter,
} from "@/lib/repositories/routers";
import type {
  Hotspot,
  HotspotStatus,
  HotspotWithRouter,
  PublicRouter,
} from "@/lib/types";

async function withRouter(
  hotspot: Hotspot,
  ownerId: string,
): Promise<HotspotWithRouter> {
  const router = hotspot.routerId
    ? await getRouterById(hotspot.routerId, ownerId)
    : null;
  return {
    ...hotspot,
    router: router ? toPublicRouter(router) : null,
  };
}

async function syncRouterHotspotLink(
  ownerId: string,
  hotspotId: string,
  routerId: string | null | undefined,
): Promise<void> {
  if (routerId === undefined) return;
  const routers = await import("@/lib/repositories/routers").then((m) =>
    m.listRoutersByOwner(ownerId),
  );
  for (const r of routers) {
    if (routerId && r.id === routerId) {
      if (r.hotspotId !== hotspotId) {
        await updateRouter(r.id, ownerId, { hotspotId });
      }
    } else if (r.hotspotId === hotspotId && r.id !== routerId) {
      await updateRouter(r.id, ownerId, { hotspotId: null });
    }
  }
}

export async function listHotspotsByOwner(
  ownerId: string,
): Promise<HotspotWithRouter[]> {
  const hotspots = await sb.listHotspotsByOwner(ownerId);
  return Promise.all(hotspots.map((h) => withRouter(h, ownerId)));
}

export async function getHotspotById(
  id: string,
  ownerId?: string,
): Promise<Hotspot | null> {
  return sb.getHotspotById(id, ownerId);
}

/** Resolve by professional slug or legacy UUID (old QR codes still work). */
export async function getHotspotBySlugOrId(
  slugOrId: string,
): Promise<Hotspot | null> {
  return sb.getHotspotBySlugOrId(slugOrId);
}

export async function getHotspotWithRouter(
  id: string,
  ownerId: string,
): Promise<HotspotWithRouter | null> {
  const hotspot = await getHotspotById(id, ownerId);
  if (!hotspot) return null;
  return withRouter(hotspot, ownerId);
}

export async function createHotspot(
  ownerId: string,
  input: {
    name: string;
    ssid: string;
    address: string;
    status: HotspotStatus;
    routerId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<Hotspot> {
  const hotspot = await sb.createHotspot(ownerId, input);
  if (input.routerId) {
    await updateRouter(input.routerId, ownerId, { hotspotId: hotspot.id });
  }
  return hotspot;
}

export async function updateHotspot(
  id: string,
  ownerId: string,
  patch: Partial<
    Pick<
      Hotspot,
      | "name"
      | "ssid"
      | "address"
      | "status"
      | "routerId"
      | "latitude"
      | "longitude"
      | "freeModeEnabled"
      | "freeModeStartsAt"
      | "freeModeEndsAt"
      | "freeModePackageId"
    >
  >,
): Promise<Hotspot | null> {
  const updated = await sb.updateHotspot(id, ownerId, patch);
  if (updated && patch.routerId !== undefined) {
    await syncRouterHotspotLink(ownerId, id, patch.routerId);
  }
  return updated;
}

export async function deleteHotspot(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const deleted = await sb.deleteHotspot(id, ownerId);
  if (deleted) {
    const { listRoutersByOwner } = await import("@/lib/repositories/routers");
    const routers = await listRoutersByOwner(ownerId);
    for (const r of routers) {
      if (r.hotspotId === id) {
        await updateRouter(r.id, ownerId, { hotspotId: null });
      }
    }
  }
  return deleted;
}

export type { PublicRouter };
