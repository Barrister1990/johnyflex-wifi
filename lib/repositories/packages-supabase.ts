import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Package } from "@/lib/types";

type PackageRow = {
  id: string;
  owner_id: string;
  name: string;
  price: number | string;
  duration_minutes: number;
  data_limit_mb: number | null;
  speed_profile: string;
  currency: string;
  enabled: boolean;
  hotspot_ids: string[] | null;
  created_at: string;
  updated_at: string;
};

function mapPackage(row: PackageRow): Package {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    price: typeof row.price === "string" ? Number(row.price) : row.price,
    durationMinutes: row.duration_minutes,
    dataLimitMb: row.data_limit_mb,
    speedProfile: row.speed_profile,
    currency: row.currency,
    enabled: row.enabled,
    hotspotIds: row.hotspot_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPackagesByOwner(ownerId: string): Promise<Package[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as PackageRow[]) ?? []).map(mapPackage);
}

export async function getPackageById(
  id: string,
  ownerId: string,
): Promise<Package | null> {
  // Service role so portal/voucher redeem works without an owner session.
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPackage(data as PackageRow) : null;
}

/** Public portal lookup (enabled packages for an owner). */
export async function listEnabledPackagesByOwner(
  ownerId: string,
): Promise<Package[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("enabled", true)
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as PackageRow[]) ?? []).map(mapPackage);
}

export async function getPackageByIdPublic(id: string): Promise<Package | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPackage(data as PackageRow) : null;
}

export async function createPackage(
  ownerId: string,
  input: Omit<Package, "id" | "ownerId" | "createdAt" | "updatedAt">,
): Promise<Package> {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const row = {
    owner_id: ownerId,
    name: input.name,
    price: input.price,
    duration_minutes: input.durationMinutes,
    data_limit_mb: input.dataLimitMb,
    speed_profile: input.speedProfile,
    currency: input.currency,
    enabled: input.enabled,
    hotspot_ids: input.hotspotIds,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("packages")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPackage(data as PackageRow);
}

export async function updatePackage(
  id: string,
  ownerId: string,
  patch: Partial<Omit<Package, "id" | "ownerId" | "createdAt">>,
): Promise<Package | null> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.durationMinutes !== undefined) {
    dbPatch.duration_minutes = patch.durationMinutes;
  }
  if (patch.dataLimitMb !== undefined) dbPatch.data_limit_mb = patch.dataLimitMb;
  if (patch.speedProfile !== undefined) dbPatch.speed_profile = patch.speedProfile;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.hotspotIds !== undefined) dbPatch.hotspot_ids = patch.hotspotIds;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("packages")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPackage(data as PackageRow) : null;
}

export async function deletePackage(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("packages")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
