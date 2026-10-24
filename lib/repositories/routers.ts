import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import type {
  PublicRouter,
  Router,
  RouterAdapterType,
  RouterConnectionStatus,
} from "@/lib/types";

type RouterRow = {
  id: string;
  owner_id: string;
  hotspot_id: string | null;
  catalog_id: string;
  vendor: string;
  model: string;
  adapter_type: RouterAdapterType;
  label: string;
  host: string | null;
  port: number | null;
  username: string | null;
  password_stored: string | null;
  connection_status: RouterConnectionStatus;
  last_checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRouter(row: RouterRow): Router {
  return {
    id: row.id,
    ownerId: row.owner_id,
    hotspotId: row.hotspot_id,
    catalogId: row.catalog_id,
    vendor: row.vendor,
    model: row.model,
    adapterType: row.adapter_type,
    label: row.label,
    host: row.host,
    port: row.port,
    username: row.username,
    passwordStored: row.password_stored
      ? decryptSecret(row.password_stored)
      : null,
    connectionStatus: row.connection_status,
    lastCheckedAt: row.last_checked_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicRouter(router: Router): PublicRouter {
  const { passwordStored: _, ...rest } = router;
  return rest;
}

export async function listRoutersByOwner(ownerId: string): Promise<Router[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("routers")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as RouterRow[]) ?? []).map(mapRouter);
}

export async function getRouterById(
  id: string,
  ownerId?: string,
): Promise<Router | null> {
  // Unscoped lookups (portal / payment unlock) use service role.
  const supabase = ownerId
    ? await createServerSupabaseClient()
    : createServiceSupabaseClient();
  let query = supabase.from("routers").select("*").eq("id", id);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRouter(data as RouterRow) : null;
}

export async function createRouter(input: {
  ownerId: string;
  hotspotId?: string | null;
  catalogId: string;
  vendor: string;
  model: string;
  adapterType: RouterAdapterType;
  label: string;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string | null;
  connectionStatus?: RouterConnectionStatus;
  notes?: string | null;
}): Promise<Router> {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const row = {
    owner_id: input.ownerId,
    hotspot_id: input.hotspotId ?? null,
    catalog_id: input.catalogId,
    vendor: input.vendor,
    model: input.model,
    adapter_type: input.adapterType,
    label: input.label,
    host: input.host ?? null,
    port: input.port ?? null,
    username: input.username ?? null,
    password_stored: input.password ? encryptSecret(input.password) : null,
    connection_status: input.connectionStatus ?? "unconfigured",
    last_checked_at: null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("routers")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRouter(data as RouterRow);
}

export async function updateRouter(
  id: string,
  ownerId: string,
  patch: Partial<
    Pick<
      Router,
      | "hotspotId"
      | "label"
      | "host"
      | "port"
      | "username"
      | "passwordStored"
      | "connectionStatus"
      | "lastCheckedAt"
      | "notes"
      | "catalogId"
      | "vendor"
      | "model"
      | "adapterType"
    >
  >,
): Promise<Router | null> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.hotspotId !== undefined) dbPatch.hotspot_id = patch.hotspotId;
  if (patch.label !== undefined) dbPatch.label = patch.label;
  if (patch.host !== undefined) dbPatch.host = patch.host;
  if (patch.port !== undefined) dbPatch.port = patch.port;
  if (patch.username !== undefined) dbPatch.username = patch.username;
  if (patch.passwordStored !== undefined) {
    dbPatch.password_stored = patch.passwordStored
      ? encryptSecret(patch.passwordStored)
      : null;
  }
  if (patch.connectionStatus !== undefined) {
    dbPatch.connection_status = patch.connectionStatus;
  }
  if (patch.lastCheckedAt !== undefined) {
    dbPatch.last_checked_at = patch.lastCheckedAt;
  }
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.catalogId !== undefined) dbPatch.catalog_id = patch.catalogId;
  if (patch.vendor !== undefined) dbPatch.vendor = patch.vendor;
  if (patch.model !== undefined) dbPatch.model = patch.model;
  if (patch.adapterType !== undefined) dbPatch.adapter_type = patch.adapterType;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("routers")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRouter(data as RouterRow) : null;
}

export async function deleteRouter(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  // Clear hotspot.router_id links first
  await supabase
    .from("hotspots")
    .update({ router_id: null, updated_at: new Date().toISOString() })
    .eq("router_id", id)
    .eq("owner_id", ownerId);

  const { data, error } = await supabase
    .from("routers")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function attachRouterToHotspot(
  routerId: string,
  hotspotId: string,
  ownerId: string,
): Promise<void> {
  const router = await getRouterById(routerId, ownerId);
  const { getHotspotById } = await import("@/lib/repositories/hotspots");
  const hotspot = await getHotspotById(hotspotId, ownerId);
  if (!router || !hotspot) {
    throw new Error("Router or hotspot not found");
  }

  const now = new Date().toISOString();
  const supabase = await createServerSupabaseClient();

  // Detach router from previous hotspot
  await supabase
    .from("hotspots")
    .update({ router_id: null, updated_at: now })
    .eq("router_id", routerId)
    .eq("owner_id", ownerId);

  // Detach other routers from this hotspot
  await supabase
    .from("routers")
    .update({ hotspot_id: null, updated_at: now })
    .eq("hotspot_id", hotspotId)
    .eq("owner_id", ownerId)
    .neq("id", routerId);

  await supabase
    .from("hotspots")
    .update({ router_id: routerId, updated_at: now })
    .eq("id", hotspotId)
    .eq("owner_id", ownerId);

  await supabase
    .from("routers")
    .update({ hotspot_id: hotspotId, updated_at: now })
    .eq("id", routerId)
    .eq("owner_id", ownerId);
}
