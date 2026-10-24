import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/types";

type PlanRow = {
  id: string;
  owner_id: string;
  name: string;
  price: number | string;
  currency: string;
  speed_profile: string;
  data_limit_mb: number | null;
  interval_days: number;
  hotspot_id: string | null;
  linked_package_id: string;
  enabled: boolean;
  description: string;
  created_at: string;
  updated_at: string;
};

type SubRow = {
  id: string;
  owner_id: string;
  plan_id: string;
  customer_email: string;
  hotspot_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  last_payment_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapPlan(row: PlanRow): SubscriptionPlan {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    price: typeof row.price === "string" ? Number(row.price) : row.price,
    currency: row.currency,
    speedProfile: row.speed_profile,
    dataLimitMb: row.data_limit_mb,
    intervalDays: row.interval_days,
    hotspotId: row.hotspot_id,
    linkedPackageId: row.linked_package_id,
    enabled: row.enabled,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubscription(row: SubRow): Subscription {
  return {
    id: row.id,
    ownerId: row.owner_id,
    planId: row.plan_id,
    customerEmail: row.customer_email,
    hotspotId: row.hotspot_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    lastPaymentId: row.last_payment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlansByOwner(
  ownerId: string,
): Promise<SubscriptionPlan[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("owner_id", ownerId)
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as PlanRow[]) ?? []).map(mapPlan);
}

/** Portal-safe: enabled plans for an owner (service role). */
export async function listEnabledPlansByOwner(
  ownerId: string,
): Promise<SubscriptionPlan[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("enabled", true)
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as PlanRow[]) ?? []).map(mapPlan);
}

export async function getPlanById(
  id: string,
  ownerId?: string,
): Promise<SubscriptionPlan | null> {
  // Portal may look up plans without owner session
  const supabase = createServiceSupabaseClient();
  let query = supabase.from("subscription_plans").select("*").eq("id", id);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPlan(data as PlanRow) : null;
}

export async function createPlan(
  ownerId: string,
  input: Omit<SubscriptionPlan, "id" | "ownerId" | "createdAt" | "updatedAt">,
): Promise<SubscriptionPlan> {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("subscription_plans")
    .insert({
      owner_id: ownerId,
      name: input.name,
      price: input.price,
      currency: input.currency,
      speed_profile: input.speedProfile,
      data_limit_mb: input.dataLimitMb,
      interval_days: input.intervalDays,
      hotspot_id: input.hotspotId,
      linked_package_id: input.linkedPackageId,
      enabled: input.enabled,
      description: input.description,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPlan(data as PlanRow);
}

export async function updatePlan(
  id: string,
  ownerId: string,
  patch: Partial<Omit<SubscriptionPlan, "id" | "ownerId" | "createdAt">>,
): Promise<SubscriptionPlan | null> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.speedProfile !== undefined) dbPatch.speed_profile = patch.speedProfile;
  if (patch.dataLimitMb !== undefined) dbPatch.data_limit_mb = patch.dataLimitMb;
  if (patch.intervalDays !== undefined) dbPatch.interval_days = patch.intervalDays;
  if (patch.hotspotId !== undefined) dbPatch.hotspot_id = patch.hotspotId;
  if (patch.linkedPackageId !== undefined) {
    dbPatch.linked_package_id = patch.linkedPackageId;
  }
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.description !== undefined) dbPatch.description = patch.description;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPlan(data as PlanRow) : null;
}

export async function deletePlan(id: string, ownerId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function listSubscriptionsByOwner(
  ownerId: string,
): Promise<Subscription[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as SubRow[]) ?? []).map(mapSubscription);
}

export async function upsertActiveSubscription(input: {
  ownerId: string;
  planId: string;
  customerEmail: string;
  hotspotId: string;
  intervalDays: number;
  paymentId: string;
}): Promise<Subscription> {
  const email = input.customerEmail.toLowerCase();
  const now = new Date();
  const periodEnd = new Date(
    now.getTime() + input.intervalDays * 24 * 60 * 60 * 1000,
  );
  const createdAt = now.toISOString();
  // Payment webhook / portal path — service role
  const supabase = createServiceSupabaseClient();

  const { data: existingRows, error: findError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("owner_id", input.ownerId)
    .eq("plan_id", input.planId)
    .eq("hotspot_id", input.hotspotId)
    .ilike("customer_email", email)
    .in("status", ["active", "past_due"]);
  if (findError) throw new Error(findError.message);

  const existing = ((existingRows as SubRow[]) ?? [])[0];
  if (existing) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: createdAt,
        current_period_end: periodEnd.toISOString(),
        last_payment_id: input.paymentId,
        updated_at: createdAt,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapSubscription(data as SubRow);
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      owner_id: input.ownerId,
      plan_id: input.planId,
      customer_email: email,
      hotspot_id: input.hotspotId,
      status: "active",
      current_period_start: createdAt,
      current_period_end: periodEnd.toISOString(),
      last_payment_id: input.paymentId,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSubscription(data as SubRow);
}

export async function updateSubscriptionStatus(
  id: string,
  ownerId: string,
  status: SubscriptionStatus,
): Promise<Subscription | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSubscription(data as SubRow) : null;
}
