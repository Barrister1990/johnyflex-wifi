import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ensureUniqueSlug,
  portalPath,
  slugifyHotspotName,
} from "@/lib/hotspots/slug";
import type { Hotspot, HotspotStatus } from "@/lib/types";

type HotspotRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  ssid: string;
  address: string;
  status: HotspotStatus;
  qr_payload: string;
  router_id: string | null;
  latitude: number | null;
  longitude: number | null;
  free_mode_enabled?: boolean | null;
  free_mode_starts_at?: string | null;
  free_mode_ends_at?: string | null;
  free_mode_package_id?: string | null;
  paystack_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapHotspot(row: HotspotRow): Hotspot {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    ssid: row.ssid,
    address: row.address,
    status: row.status,
    qrPayload: row.qr_payload,
    routerId: row.router_id,
    latitude: row.latitude,
    longitude: row.longitude,
    freeModeEnabled: Boolean(row.free_mode_enabled),
    freeModeStartsAt: row.free_mode_starts_at ?? null,
    freeModeEndsAt: row.free_mode_ends_at ?? null,
    freeModePackageId: row.free_mode_package_id ?? null,
    // Default true when column missing (pre-migration rows / older caches)
    paystackEnabled: row.paystack_enabled !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function allocateSlug(
  name: string,
  excludeId?: string,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("hotspots").select("id, slug");
  if (error) throw new Error(error.message);
  const taken = (data ?? [])
    .filter((row) => row.id !== excludeId)
    .map((row) => row.slug as string);
  return ensureUniqueSlug(slugifyHotspotName(name), taken);
}

export async function listHotspotsByOwner(ownerId: string): Promise<Hotspot[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("hotspots")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as HotspotRow[]) ?? []).map(mapHotspot);
}

export async function getHotspotById(
  id: string,
  ownerId?: string,
): Promise<Hotspot | null> {
  // Unscoped lookups (portal / payments) use service role so inactive rows resolve.
  const supabase = ownerId
    ? await createServerSupabaseClient()
    : createServiceSupabaseClient();
  let query = supabase.from("hotspots").select("*").eq("id", id);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapHotspot(data as HotspotRow) : null;
}

/** Public portal lookup by slug or legacy UUID. */
export async function getHotspotBySlugOrId(
  slugOrId: string,
): Promise<Hotspot | null> {
  const supabase = createServiceSupabaseClient();
  const bySlug = await supabase
    .from("hotspots")
    .select("*")
    .eq("slug", slugOrId)
    .maybeSingle();
  if (bySlug.error) throw new Error(bySlug.error.message);
  if (bySlug.data) return mapHotspot(bySlug.data as HotspotRow);

  const byId = await supabase
    .from("hotspots")
    .select("*")
    .eq("id", slugOrId)
    .maybeSingle();
  if (byId.error) throw new Error(byId.error.message);
  return byId.data ? mapHotspot(byId.data as HotspotRow) : null;
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
  const supabase = await createServerSupabaseClient();
  const slug = await allocateSlug(input.name);
  const now = new Date().toISOString();
  const row = {
    owner_id: ownerId,
    name: input.name,
    slug,
    ssid: input.ssid,
    address: input.address,
    status: input.status,
    qr_payload: portalPath({ slug }),
    router_id: input.routerId ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("hotspots")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapHotspot(data as HotspotRow);
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
      | "paystackEnabled"
    >
  >,
): Promise<Hotspot | null> {
  const existing = await getHotspotById(id, ownerId);
  if (!existing) return null;

  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) {
    dbPatch.name = patch.name;
    if (patch.name !== existing.name) {
      const slug = await allocateSlug(patch.name, id);
      dbPatch.slug = slug;
      dbPatch.qr_payload = portalPath({ slug });
    }
  }
  if (patch.ssid !== undefined) dbPatch.ssid = patch.ssid;
  if (patch.address !== undefined) dbPatch.address = patch.address;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.routerId !== undefined) dbPatch.router_id = patch.routerId;
  if (patch.latitude !== undefined) dbPatch.latitude = patch.latitude;
  if (patch.longitude !== undefined) dbPatch.longitude = patch.longitude;
  if (patch.freeModeEnabled !== undefined) {
    dbPatch.free_mode_enabled = patch.freeModeEnabled;
  }
  if (patch.freeModeStartsAt !== undefined) {
    dbPatch.free_mode_starts_at = patch.freeModeStartsAt;
  }
  if (patch.freeModeEndsAt !== undefined) {
    dbPatch.free_mode_ends_at = patch.freeModeEndsAt;
  }
  if (patch.freeModePackageId !== undefined) {
    dbPatch.free_mode_package_id = patch.freeModePackageId;
  }
  if (patch.paystackEnabled !== undefined) {
    dbPatch.paystack_enabled = patch.paystackEnabled;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("hotspots")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapHotspot(data as HotspotRow) : null;
}

export async function deleteHotspot(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("hotspots")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
