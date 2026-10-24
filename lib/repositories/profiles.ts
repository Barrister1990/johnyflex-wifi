import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { PublicUser } from "@/lib/types";

export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  support_email: string | null;
  currency: string;
  timezone: string;
  notify_payment_success: boolean;
  notify_session_expired: boolean;
  notify_system: boolean;
  free_mode_enabled?: boolean | null;
  free_mode_starts_at?: string | null;
  free_mode_ends_at?: string | null;
  free_mode_package_id?: string | null;
  created_at: string;
  updated_at: string;
};

export function profileToPublic(row: ProfileRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    businessName: row.business_name,
    phone: row.phone,
    supportEmail: row.support_email,
    currency: row.currency,
    timezone: row.timezone,
    notifyPaymentSuccess: row.notify_payment_success,
    notifySessionExpired: row.notify_session_expired,
    notifySystem: row.notify_system,
    freeModeEnabled: Boolean(row.free_mode_enabled),
    freeModeStartsAt: row.free_mode_starts_at ?? null,
    freeModeEndsAt: row.free_mode_ends_at ?? null,
    freeModePackageId: row.free_mode_package_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as ProfileRow | null) ?? null;
}

/** Public portal / webhooks — bypasses RLS (profiles are owner-only). */
export async function getProfileByIdService(
  id: string,
): Promise<ProfileRow | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as ProfileRow | null) ?? null;
}

export async function ensureProfileForAuthUser(input: {
  id: string;
  email: string;
  name?: string | null;
}): Promise<ProfileRow> {
  const existing = await getProfileById(input.id);
  if (existing) return existing;

  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const row = {
    id: input.id,
    email: input.email.toLowerCase(),
    name:
      input.name?.trim() ||
      input.email.split("@")[0] ||
      "Operator",
    business_name: null,
    phone: null,
    support_email: null,
    currency: "GHS",
    timezone: "Africa/Accra",
    notify_payment_success: true,
    notify_session_expired: true,
    notify_system: true,
    free_mode_enabled: false,
    free_mode_starts_at: null,
    free_mode_ends_at: null,
    free_mode_package_id: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as ProfileRow;
}

export async function updateProfile(
  id: string,
  patch: Partial<{
    name: string;
    businessName: string | null;
    phone: string | null;
    supportEmail: string | null;
    currency: string;
    timezone: string;
    notifyPaymentSuccess: boolean;
    notifySessionExpired: boolean;
    notifySystem: boolean;
    freeModeEnabled: boolean;
    freeModeStartsAt: string | null;
    freeModeEndsAt: string | null;
    freeModePackageId: string | null;
  }>,
): Promise<ProfileRow | null> {
  const supabase = await createServerSupabaseClient();
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.businessName !== undefined) dbPatch.business_name = patch.businessName;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.supportEmail !== undefined) dbPatch.support_email = patch.supportEmail;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;
  if (patch.notifyPaymentSuccess !== undefined) {
    dbPatch.notify_payment_success = patch.notifyPaymentSuccess;
  }
  if (patch.notifySessionExpired !== undefined) {
    dbPatch.notify_session_expired = patch.notifySessionExpired;
  }
  if (patch.notifySystem !== undefined) dbPatch.notify_system = patch.notifySystem;
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

  const { data, error } = await supabase
    .from("profiles")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
}
