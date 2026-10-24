import * as packageRepo from "@/lib/repositories/packages";
import { requireUser } from "@/lib/services/auth";
import type { Package } from "@/lib/types";
import { packageSchema, packageUpdateSchema } from "@/lib/validations";

export async function listPackages(): Promise<Package[]> {
  const user = await requireUser();
  return packageRepo.listPackagesByOwner(user.id);
}

export async function createPackage(raw: unknown): Promise<Package> {
  const user = await requireUser();
  const data = packageSchema.parse(raw);
  return packageRepo.createPackage(user.id, {
    name: data.name,
    price: data.price,
    durationMinutes: data.durationMinutes,
    dataLimitMb: data.dataLimitMb,
    speedProfile: data.speedProfile,
    currency: data.currency ?? "GHS",
    enabled: data.enabled ?? true,
    hotspotIds: data.hotspotIds === undefined ? null : data.hotspotIds,
  });
}

export async function updatePackage(
  id: string,
  raw: unknown,
): Promise<Package> {
  const user = await requireUser();
  const data = packageUpdateSchema.parse(raw);
  const updated = await packageRepo.updatePackage(id, user.id, data);
  if (!updated) throw new Error("Package not found");
  return updated;
}

export async function deletePackage(id: string): Promise<void> {
  const user = await requireUser();
  const ok = await packageRepo.deletePackage(id, user.id);
  if (!ok) throw new Error("Package not found");
}
