import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { Vendor, VendorCollection } from "@/lib/types";

type VendorRow = {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  hotspot_id: string | null;
  commission_percent: number | string;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type CollectionRow = {
  id: string;
  owner_id: string;
  vendor_id: string;
  amount: number | string;
  commission_amount: number | string;
  currency: string;
  expense_id: string | null;
  collected_at: string;
  notes: string | null;
  created_at: string;
};

const num = (v: number | string) => (typeof v === "string" ? Number(v) : v);

function mapVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    phone: row.phone,
    hotspotId: row.hotspot_id,
    commissionPercent: num(row.commission_percent),
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCollection(row: CollectionRow): VendorCollection {
  return {
    id: row.id,
    ownerId: row.owner_id,
    vendorId: row.vendor_id,
    amount: num(row.amount),
    commissionAmount: num(row.commission_amount),
    currency: row.currency,
    expenseId: row.expense_id,
    collectedAt: row.collected_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listVendorsByOwner(ownerId: string): Promise<Vendor[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as VendorRow[]) ?? []).map(mapVendor);
}

export async function getVendorById(
  id: string,
  ownerId: string,
): Promise<Vendor | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVendor(data as VendorRow) : null;
}

export async function createVendor(input: {
  ownerId: string;
  name: string;
  phone: string | null;
  hotspotId: string | null;
  commissionPercent: number;
  notes: string | null;
}): Promise<Vendor> {
  const now = new Date().toISOString();
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      phone: input.phone,
      hotspot_id: input.hotspotId,
      commission_percent: input.commissionPercent,
      notes: input.notes,
      active: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapVendor(data as VendorRow);
}

export async function updateVendor(
  id: string,
  ownerId: string,
  patch: Partial<
    Pick<
      Vendor,
      "name" | "phone" | "hotspotId" | "commissionPercent" | "notes" | "active"
    >
  >,
): Promise<Vendor | null> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.hotspotId !== undefined) dbPatch.hotspot_id = patch.hotspotId;
  if (patch.commissionPercent !== undefined) {
    dbPatch.commission_percent = patch.commissionPercent;
  }
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.active !== undefined) dbPatch.active = patch.active;

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vendors")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVendor(data as VendorRow) : null;
}

export async function deleteVendor(id: string, ownerId: string): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

export async function listCollectionsByOwner(
  ownerId: string,
  vendorId?: string,
): Promise<VendorCollection[]> {
  const supabase = createServiceSupabaseClient();
  let q = supabase
    .from("vendor_collections")
    .select("*")
    .eq("owner_id", ownerId)
    .order("collected_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data as CollectionRow[]) ?? []).map(mapCollection);
}

export async function getCollectionById(
  id: string,
  ownerId: string,
): Promise<VendorCollection | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vendor_collections")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCollection(data as CollectionRow) : null;
}

export async function createCollection(input: {
  ownerId: string;
  vendorId: string;
  amount: number;
  commissionAmount: number;
  currency: string;
  expenseId: string | null;
  collectedAt: string;
  notes: string | null;
}): Promise<VendorCollection> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vendor_collections")
    .insert({
      owner_id: input.ownerId,
      vendor_id: input.vendorId,
      amount: input.amount,
      commission_amount: input.commissionAmount,
      currency: input.currency,
      expense_id: input.expenseId,
      collected_at: input.collectedAt.slice(0, 10),
      notes: input.notes,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCollection(data as CollectionRow);
}

export async function deleteCollection(
  id: string,
  ownerId: string,
): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("vendor_collections")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}
