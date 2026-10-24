import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type {
  Payment,
  PaymentCallback,
  PaymentProvider,
  PaymentStatus,
} from "@/lib/types";

type PaymentRow = {
  id: string;
  reference: string;
  hotspot_id: string;
  package_id: string;
  subscription_plan_id: string | null;
  customer_email: string;
  amount: number | string;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  provider_ref: string | null;
  client_mac: string | null;
  created_at: string;
  updated_at: string;
};

type CallbackRow = {
  id: string;
  payment_id: string;
  raw_payload: unknown;
  verified: boolean;
  created_at: string;
};

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    reference: row.reference,
    hotspotId: row.hotspot_id,
    packageId: row.package_id,
    subscriptionPlanId: row.subscription_plan_id,
    customerEmail: row.customer_email,
    amount: typeof row.amount === "string" ? Number(row.amount) : row.amount,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerRef: row.provider_ref,
    clientMac: row.client_mac ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCallback(row: CallbackRow): PaymentCallback {
  return {
    id: row.id,
    paymentId: row.payment_id,
    rawPayload: row.raw_payload,
    verified: row.verified,
    createdAt: row.created_at,
  };
}

export async function createPayment(input: {
  reference: string;
  hotspotId: string;
  packageId: string;
  customerEmail: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status?: PaymentStatus;
  providerRef?: string | null;
  subscriptionPlanId?: string | null;
  clientMac?: string | null;
}): Promise<Payment> {
  const now = new Date().toISOString();
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      reference: input.reference,
      hotspot_id: input.hotspotId,
      package_id: input.packageId,
      subscription_plan_id: input.subscriptionPlanId ?? null,
      customer_email: input.customerEmail.toLowerCase(),
      amount: input.amount,
      currency: input.currency,
      status: input.status ?? "pending",
      provider: input.provider,
      provider_ref: input.providerRef ?? null,
      client_mac: input.clientMac ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPayment(data as PaymentRow);
}

export async function getPaymentByReference(
  reference: string,
): Promise<Payment | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPayment(data as PaymentRow) : null;
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPayment(data as PaymentRow) : null;
}

export async function updatePaymentStatus(
  reference: string,
  status: PaymentStatus,
  providerRef?: string | null,
): Promise<Payment | null> {
  const supabase = createServiceSupabaseClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (providerRef !== undefined) patch.provider_ref = providerRef;

  const { data, error } = await supabase
    .from("payments")
    .update(patch)
    .eq("reference", reference)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPayment(data as PaymentRow) : null;
}

/** Mark success only from pending (or keep success). Never demotes success → failed. */
export async function markPaymentSuccess(
  reference: string,
  providerRef?: string | null,
): Promise<Payment | null> {
  const existing = await getPaymentByReference(reference);
  if (!existing) return null;
  if (existing.status === "success") {
    if (providerRef && !existing.providerRef) {
      return updatePaymentStatus(reference, "success", providerRef);
    }
    return existing;
  }
  return updatePaymentStatus(reference, "success", providerRef);
}

export async function updatePaymentClientMac(
  reference: string,
  clientMac: string,
): Promise<Payment | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .update({
      client_mac: clientMac,
      updated_at: new Date().toISOString(),
    })
    .eq("reference", reference)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPayment(data as PaymentRow) : null;
}

export async function addPaymentCallback(input: {
  paymentId: string;
  rawPayload: unknown;
  verified: boolean;
}): Promise<PaymentCallback> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payment_callbacks")
    .insert({
      payment_id: input.paymentId,
      raw_payload: input.rawPayload ?? {},
      verified: input.verified,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCallback(data as CallbackRow);
}

export async function listSuccessPaymentsByClientMac(
  macAddress: string,
  hotspotIds: string[],
): Promise<Payment[]> {
  if (hotspotIds.length === 0) return [];
  const mac = macAddress.trim().toLowerCase();
  if (!mac) return [];
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .in("hotspot_id", hotspotIds)
    .eq("status", "success")
    .ilike("client_mac", mac)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return ((data as PaymentRow[]) ?? []).map(mapPayment);
}

export async function listPaymentsByHotspotIds(
  hotspotIds: string[],
): Promise<Payment[]> {
  if (hotspotIds.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .in("hotspot_id", hotspotIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as PaymentRow[]) ?? []).map(mapPayment);
}

export async function listPaymentsByEmailAndHotspot(
  email: string,
  hotspotId: string,
): Promise<Payment[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("hotspot_id", hotspotId)
    .ilike("customer_email", email.trim().toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as PaymentRow[]) ?? []).map(mapPayment);
}

