import { getHotspotById, listHotspotsByOwner } from "@/lib/repositories/hotspots";
import * as packageRepo from "@/lib/repositories/packages";
import * as subRepo from "@/lib/repositories/subscriptions";
import { requireUser } from "@/lib/services/auth";
import type { SubscriptionListItem, SubscriptionPlan } from "@/lib/types";
import {
  subscriptionPlanSchema,
  subscriptionPlanUpdateSchema,
} from "@/lib/validations";

export async function listOwnerSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const user = await requireUser();
  return subRepo.listPlansByOwner(user.id);
}

export async function listOwnerSubscriptions(): Promise<SubscriptionListItem[]> {
  const user = await requireUser();
  const subs = await subRepo.listSubscriptionsByOwner(user.id);
  const plans = await subRepo.listPlansByOwner(user.id);
  const hotspots = await listHotspotsByOwner(user.id);
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const hotspotMap = new Map(hotspots.map((h) => [h.id, h]));
  const now = Date.now();

  return subs.map((s) => {
    let status = s.status;
    if (
      status === "active" &&
      new Date(s.currentPeriodEnd).getTime() < now
    ) {
      status = "expired";
    }
    const plan = planMap.get(s.planId);
    return {
      ...s,
      status,
      planName: plan?.name ?? "Plan",
      hotspotName: hotspotMap.get(s.hotspotId)?.name ?? "Unknown",
      speedProfile: plan?.speedProfile ?? "—",
      price: plan?.price ?? 0,
      currency: plan?.currency ?? "GHS",
    };
  });
}

export async function createSubscriptionPlan(raw: unknown) {
  const user = await requireUser();
  const data = subscriptionPlanSchema.parse(raw);
  if (data.hotspotId) {
    const hs = await getHotspotById(data.hotspotId);
    if (!hs || hs.ownerId !== user.id) throw new Error("Hotspot not found");
  }

  const linked = await packageRepo.createPackage(user.id, {
    name: `${data.name} Monthly`,
    price: data.price,
    durationMinutes: data.intervalDays * 1440,
    dataLimitMb: data.dataLimitMb,
    speedProfile: data.speedProfile,
    currency: data.currency,
    enabled: false,
    hotspotIds: data.hotspotId ? [data.hotspotId] : null,
  });

  return subRepo.createPlan(user.id, {
    name: data.name,
    price: data.price,
    currency: data.currency,
    speedProfile: data.speedProfile,
    dataLimitMb: data.dataLimitMb,
    intervalDays: data.intervalDays,
    hotspotId: data.hotspotId ?? null,
    linkedPackageId: linked.id,
    enabled: data.enabled,
    description: data.description,
  });
}

export async function updateSubscriptionPlan(id: string, raw: unknown) {
  const user = await requireUser();
  const data = subscriptionPlanUpdateSchema.parse(raw);
  if (data.hotspotId) {
    const hs = await getHotspotById(data.hotspotId);
    if (!hs || hs.ownerId !== user.id) throw new Error("Hotspot not found");
  }
  const existing = await subRepo.getPlanById(id, user.id);
  if (!existing) throw new Error("Plan not found");

  if (
    data.price !== undefined ||
    data.speedProfile !== undefined ||
    data.dataLimitMb !== undefined ||
    data.intervalDays !== undefined ||
    data.currency !== undefined ||
    data.name !== undefined ||
    data.hotspotId !== undefined
  ) {
    const hotspotId =
      data.hotspotId !== undefined ? data.hotspotId : existing.hotspotId;
    await packageRepo.updatePackage(existing.linkedPackageId, user.id, {
      name: `${data.name ?? existing.name} Monthly`,
      price: data.price ?? existing.price,
      durationMinutes:
        (data.intervalDays ?? existing.intervalDays) * 1440,
      dataLimitMb:
        data.dataLimitMb !== undefined
          ? data.dataLimitMb
          : existing.dataLimitMb,
      speedProfile: data.speedProfile ?? existing.speedProfile,
      currency: data.currency ?? existing.currency,
      hotspotIds: hotspotId ? [hotspotId] : null,
    });
  }

  const updated = await subRepo.updatePlan(id, user.id, data);
  if (!updated) throw new Error("Plan not found");
  return updated;
}

export async function deleteSubscriptionPlan(id: string) {
  const user = await requireUser();
  const existing = await subRepo.getPlanById(id, user.id);
  if (!existing) throw new Error("Plan not found");
  await packageRepo.deletePackage(existing.linkedPackageId, user.id);
  const ok = await subRepo.deletePlan(id, user.id);
  if (!ok) throw new Error("Plan not found");
}

export async function cancelOwnerSubscription(id: string) {
  const user = await requireUser();
  const updated = await subRepo.updateSubscriptionStatus(
    id,
    user.id,
    "cancelled",
  );
  if (!updated) throw new Error("Subscription not found");
  return updated;
}

export async function listPortalSubscriptionPlans(hotspotId: string) {
  const hotspot = await getHotspotById(hotspotId);
  if (!hotspot) throw new Error("Hotspot not found");
  const plans = await subRepo.listEnabledPlansByOwner(hotspot.ownerId);
  return plans.filter(
    (p) => p.hotspotId == null || p.hotspotId === hotspotId,
  );
}
