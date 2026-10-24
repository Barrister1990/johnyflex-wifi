import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { Voucher, VoucherBatch, VoucherStatus } from "@/lib/types";

type BatchRow = {
  id: string;
  owner_id: string;
  package_id: string;
  hotspot_id: string | null;
  label: string;
  quantity: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type VoucherRow = {
  id: string;
  batch_id: string;
  owner_id: string;
  package_id: string;
  hotspot_id: string | null;
  code: string;
  status: VoucherStatus;
  redeemed_at: string | null;
  redeemed_by_email: string | null;
  payment_id: string | null;
  expires_at: string | null;
  vendor_id?: string | null;
  assigned_at?: string | null;
  created_at: string;
  updated_at: string;
};

function mapBatch(row: BatchRow): VoucherBatch {
  return {
    id: row.id,
    ownerId: row.owner_id,
    packageId: row.package_id,
    hotspotId: row.hotspot_id,
    label: row.label,
    quantity: row.quantity,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVoucher(row: VoucherRow): Voucher {
  return {
    id: row.id,
    batchId: row.batch_id,
    ownerId: row.owner_id,
    packageId: row.package_id,
    hotspotId: row.hotspot_id,
    code: row.code,
    status: row.status,
    redeemedAt: row.redeemed_at,
    redeemedByEmail: row.redeemed_by_email,
    paymentId: row.payment_id,
    expiresAt: row.expires_at,
    vendorId: row.vendor_id ?? null,
    assignedAt: row.assigned_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function chunk(code: string, size: number) {
  const parts: string[] = [];
  for (let i = 0; i < code.length; i += size) {
    parts.push(code.slice(i, i + size));
  }
  return parts.join("-");
}

export function generateVoucherCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) {
    raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return `WF-${chunk(raw.slice(0, 8), 4)}`;
}

export async function createVoucherBatch(input: {
  ownerId: string;
  packageId: string;
  hotspotId: string | null;
  label: string;
  quantity: number;
  expiresAt: string | null;
  vendorId?: string | null;
}): Promise<{ batch: VoucherBatch; vouchers: Voucher[] }> {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data: existingCodesData, error: codesError } = await supabase
    .from("vouchers")
    .select("code");
  if (codesError) throw new Error(codesError.message);
  const existingCodes = new Set(
    (existingCodesData ?? []).map((v) => String(v.code).toUpperCase()),
  );

  const { data: batchData, error: batchError } = await supabase
    .from("voucher_batches")
    .insert({
      owner_id: input.ownerId,
      package_id: input.packageId,
      hotspot_id: input.hotspotId,
      label: input.label,
      quantity: input.quantity,
      expires_at: input.expiresAt,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (batchError) throw new Error(batchError.message);
  const batch = mapBatch(batchData as BatchRow);

  const voucherRows = [];
  for (let i = 0; i < input.quantity; i += 1) {
    let code = generateVoucherCode();
    while (existingCodes.has(code)) {
      code = generateVoucherCode();
    }
    existingCodes.add(code);
    voucherRows.push({
      batch_id: batch.id,
      owner_id: input.ownerId,
      package_id: input.packageId,
      hotspot_id: input.hotspotId,
      code,
      status: "unused" as const,
      redeemed_at: null,
      redeemed_by_email: null,
      payment_id: null,
      expires_at: input.expiresAt,
      ...(input.vendorId
        ? { vendor_id: input.vendorId, assigned_at: now }
        : {}),
      created_at: now,
      updated_at: now,
    });
  }

  const { data: vouchersData, error: vouchersError } = await supabase
    .from("vouchers")
    .insert(voucherRows)
    .select("*");
  if (vouchersError) throw new Error(vouchersError.message);

  return {
    batch,
    vouchers: ((vouchersData as VoucherRow[]) ?? []).map(mapVoucher),
  };
}

export async function listBatchesByOwner(ownerId: string): Promise<VoucherBatch[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("voucher_batches")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as BatchRow[]) ?? []).map(mapBatch);
}

export async function listVouchersByOwner(ownerId: string): Promise<Voucher[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as VoucherRow[]) ?? []).map(mapVoucher);
}

export async function findVoucherByCode(code: string): Promise<Voucher | null> {
  const supabase = createServiceSupabaseClient();
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from("vouchers")
    .select("*")
    .ilike("code", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVoucher(data as VoucherRow) : null;
}

export async function updateVoucher(
  id: string,
  patch: Partial<
    Pick<
      Voucher,
      | "status"
      | "redeemedAt"
      | "redeemedByEmail"
      | "paymentId"
      | "updatedAt"
    >
  >,
): Promise<Voucher | null> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.redeemedAt !== undefined) dbPatch.redeemed_at = patch.redeemedAt;
  if (patch.redeemedByEmail !== undefined) {
    dbPatch.redeemed_by_email = patch.redeemedByEmail;
  }
  if (patch.paymentId !== undefined) dbPatch.payment_id = patch.paymentId;

  // Redeem / expire from portal uses service role
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vouchers")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVoucher(data as VoucherRow) : null;
}

export async function voidVoucher(
  id: string,
  ownerId: string,
): Promise<Voucher | null> {
  const supabase = await createServerSupabaseClient();
  const { data: existing, error: findError } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!existing) return null;
  const voucher = mapVoucher(existing as VoucherRow);
  if (voucher.status !== "unused") {
    throw new Error("Only unused vouchers can be voided");
  }
  return updateVoucher(id, { status: "void" as VoucherStatus });
}

/**
 * Hand unused vouchers to a vendor (or take them back with vendorId=null).
 * Redeemed/void vouchers are left untouched so sales history stays with the vendor.
 */
export async function assignVouchersToVendor(
  ids: string[],
  ownerId: string,
  vendorId: string | null,
): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return 0;
  const now = new Date().toISOString();
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("vouchers")
    .update({
      vendor_id: vendorId,
      assigned_at: vendorId ? now : null,
      updated_at: now,
    })
    .eq("owner_id", ownerId)
    .eq("status", "unused")
    .in("id", unique)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/** Hard-delete vouchers owned by the operator. Returns how many rows were removed. */
export async function deleteVouchers(
  ids: string[],
  ownerId: string,
): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return 0;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vouchers")
    .delete()
    .eq("owner_id", ownerId)
    .in("id", unique)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
