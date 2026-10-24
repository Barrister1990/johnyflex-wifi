import { getCatalogItem, searchRouterCatalog } from "@/lib/routers/catalog";
import * as routerRepo from "@/lib/repositories/routers";
import { requireUser } from "@/lib/services/auth";
import type { PublicRouter, RouterCatalogItem } from "@/lib/types";
import {
  routerCreateSchema,
  routerUpdateSchema,
} from "@/lib/validations";

export async function searchCatalog(query: string): Promise<RouterCatalogItem[]> {
  await requireUser();
  return searchRouterCatalog(query);
}

export async function listRouters(): Promise<PublicRouter[]> {
  const user = await requireUser();
  const routers = await routerRepo.listRoutersByOwner(user.id);
  return routers.map(routerRepo.toPublicRouter);
}

export async function createRouterFromCatalog(
  raw: unknown,
): Promise<PublicRouter> {
  const user = await requireUser();
  const data = routerCreateSchema.parse(raw);
  const catalog = getCatalogItem(data.catalogId);
  if (!catalog) throw new Error("Equipment not found in catalog");

  const hasConnection = Boolean(data.host);
  const connectionStatus =
    catalog.adapterType === "mock"
      ? "mock"
      : hasConnection
        ? "pending"
        : "unconfigured";

  const router = await routerRepo.createRouter({
    ownerId: user.id,
    hotspotId: data.hotspotId ?? null,
    catalogId: catalog.id,
    vendor: catalog.vendor,
    model: catalog.model,
    adapterType: catalog.adapterType,
    label: data.label?.trim() || `${catalog.vendor} ${catalog.model}`,
    host: data.host ?? null,
    port: data.port ?? catalog.defaultPort,
    username: data.username ?? null,
    password: data.password ?? null,
    connectionStatus,
    notes: data.notes ?? null,
  });

  if (data.hotspotId) {
    await routerRepo.attachRouterToHotspot(
      router.id,
      data.hotspotId,
      user.id,
    );
  }

  const fresh = await routerRepo.getRouterById(router.id, user.id);
  return routerRepo.toPublicRouter(fresh!);
}

export async function updateRouter(
  id: string,
  raw: unknown,
): Promise<PublicRouter> {
  const user = await requireUser();
  const data = routerUpdateSchema.parse(raw);

  const patch: Parameters<typeof routerRepo.updateRouter>[2] = {};
  if (data.label !== undefined) patch.label = data.label;
  if (data.host !== undefined) patch.host = data.host;
  if (data.port !== undefined) patch.port = data.port;
  if (data.username !== undefined) patch.username = data.username;
  if (data.password !== undefined) patch.passwordStored = data.password;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.hotspotId !== undefined) patch.hotspotId = data.hotspotId;
  if (data.connectionStatus !== undefined) {
    patch.connectionStatus = data.connectionStatus;
  }

  if (data.host !== undefined || data.password !== undefined) {
    const existing = await routerRepo.getRouterById(id, user.id);
    if (existing?.adapterType === "mock") {
      patch.connectionStatus = "mock";
    } else if (data.host || existing?.host) {
      patch.connectionStatus = "pending";
    }
  }

  const updated = await routerRepo.updateRouter(id, user.id, patch);
  if (!updated) throw new Error("Router not found");

  if (data.hotspotId) {
    await routerRepo.attachRouterToHotspot(id, data.hotspotId, user.id);
  }

  const fresh = await routerRepo.getRouterById(id, user.id);
  return routerRepo.toPublicRouter(fresh!);
}

export async function deleteRouter(id: string): Promise<void> {
  const user = await requireUser();
  const ok = await routerRepo.deleteRouter(id, user.id);
  if (!ok) throw new Error("Router not found");
}

/**
 * Probe router reachability. MikroTik uses RouterOS REST with stored credentials.
 */
export async function testRouterConnection(
  id: string,
): Promise<PublicRouter & { message?: string }> {
  const user = await requireUser();
  const router = await routerRepo.getRouterById(id, user.id);
  if (!router) throw new Error("Router not found");

  const now = new Date().toISOString();

  if (router.adapterType === "mock") {
    const updated = await routerRepo.updateRouter(id, user.id, {
      connectionStatus: "mock",
      lastCheckedAt: now,
    });
    return {
      ...routerRepo.toPublicRouter(updated!),
      message: "Mock adapter OK",
    };
  }

  if (router.adapterType === "starlink") {
    const updated = await routerRepo.updateRouter(id, user.id, {
      connectionStatus: router.host ? "pending" : "unconfigured",
      lastCheckedAt: now,
      notes:
        router.notes ??
        "Starlink backhaul attached. Pair a MikroTik AP for captive portal.",
    });
    return {
      ...routerRepo.toPublicRouter(updated!),
      message: "Starlink is backhaul only — no captive REST probe.",
    };
  }

  if (router.adapterType === "mikrotik") {
    if (!router.host || !router.username) {
      const updated = await routerRepo.updateRouter(id, user.id, {
        connectionStatus: "unconfigured",
        lastCheckedAt: now,
      });
      return {
        ...routerRepo.toPublicRouter(updated!),
        message: "Add host and username in the MikroTik wizard first.",
      };
    }

    const { mikrotikProbe } = await import("@/lib/router/mikrotik-rest");
    const probe = await mikrotikProbe({
      host: router.host,
      user: router.username,
      password: router.passwordStored ?? "",
      port: router.port ?? 80,
      secure: router.port === 443,
    });

    const updated = await routerRepo.updateRouter(id, user.id, {
      connectionStatus: probe.ok ? "connected" : "error",
      lastCheckedAt: now,
    });
    return {
      ...routerRepo.toPublicRouter(updated!),
      message: probe.message,
    };
  }

  const updated = await routerRepo.updateRouter(id, user.id, {
    connectionStatus: router.host ? "pending" : "unconfigured",
    lastCheckedAt: now,
  });
  return {
    ...routerRepo.toPublicRouter(updated!),
    message: "Adapter probe not implemented for this equipment type.",
  };
}
