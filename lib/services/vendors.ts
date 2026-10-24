import * as expenseRepo from "@/lib/repositories/expenses";
import { getHotspotById, listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { listPackagesByOwner } from "@/lib/repositories/packages";
import * as vendorRepo from "@/lib/repositories/vendors";
import * as voucherRepo from "@/lib/repositories/vouchers";
import { requireUser } from "@/lib/services/auth";
import { listOwnerVouchers } from "@/lib/services/vouchers";
import type {
  Vendor,
  VendorCollection,
  VendorStats,
  VendorWithStats,
  VoucherListItem,
} from "@/lib/types";
import {
  vendorAssignSchema,
  vendorCollectionSchema,
  vendorSchema,
} from "@/lib/validations";

export const VENDOR_COMMISSION_CATEGORY = "vendor_commission";

const round2 = (n: number) => Math.round(n * 100) / 100;

function computeStats(
  vendor: Vendor,
  vouchers: VoucherListItem[],
  collections: VendorCollection[],
): VendorStats {
  let vouchersSold = 0;
  let vouchersUnsold = 0;
  let vouchersVoid = 0;
  let stockValue = 0;
  let salesValue = 0;
  for (const v of vouchers) {
    if (v.status === "redeemed") {
      vouchersSold += 1;
      salesValue += v.price;
    } else if (v.status === "unused") {
      vouchersUnsold += 1;
      stockValue += v.price;
    } else {
      vouchersVoid += 1;
    }
  }
  const commissionDue = round2((salesValue * vendor.commissionPercent) / 100);
  const collected = collections.reduce((s, c) => s + c.amount, 0);
  const commissionRecorded = collections.reduce(
    (s, c) => s + c.commissionAmount,
    0,
  );
  return {
    vouchersGiven: vouchers.length,
    vouchersSold,
    vouchersUnsold,
    vouchersVoid,
    stockValue: round2(stockValue),
    salesValue: round2(salesValue),
    commissionDue,
    expectedCash: round2(salesValue - commissionDue),
    collected: round2(collected),
    commissionRecorded: round2(commissionRecorded),
    balance: round2(salesValue - collected - commissionRecorded),
  };
}

async function loadOwnerVendorData(ownerId: string) {
  const [vendors, collections, voucherData, hotspots] = await Promise.all([
    vendorRepo.listVendorsByOwner(ownerId),
    vendorRepo.listCollectionsByOwner(ownerId),
    listOwnerVouchers(),
    listHotspotsByOwner(ownerId),
  ]);
  const hotspotName = new Map(hotspots.map((h) => [h.id, h.name]));
  const withStats: VendorWithStats[] = vendors.map((vendor) => {
    const vouchers = voucherData.vouchers.filter(
      (v) => v.vendorId === vendor.id,
    );
    const vendorCollections = collections.filter(
      (c) => c.vendorId === vendor.id,
    );
    return {
      ...vendor,
      hotspotName: vendor.hotspotId
        ? (hotspotName.get(vendor.hotspotId) ?? null)
        : null,
      stats: computeStats(vendor, vouchers, vendorCollections),
    };
  });
  return {
    vendors: withStats,
    collections,
    vouchers: voucherData.vouchers,
    currency: voucherData.currency,
  };
}

export async function listOwnerVendors(hotspotId?: string | null) {
  const user = await requireUser();
  const { vendors, currency } = await loadOwnerVendorData(user.id);
  const scoped = hotspotId
    ? vendors.filter((v) => !v.hotspotId || v.hotspotId === hotspotId)
    : vendors;
  const totals = scoped.reduce(
    (acc, v) => {
      acc.stockValue += v.stats.stockValue;
      acc.salesValue += v.stats.salesValue;
      acc.collected += v.stats.collected;
      acc.commission += v.stats.commissionRecorded;
      acc.balance += v.stats.balance;
      return acc;
    },
    { stockValue: 0, salesValue: 0, collected: 0, commission: 0, balance: 0 },
  );
  return { vendors: scoped, totals, currency };
}

export async function getOwnerVendorDetail(id: string) {
  const user = await requireUser();
  const data = await loadOwnerVendorData(user.id);
  const vendor = data.vendors.find((v) => v.id === id);
  if (!vendor) throw new Error("Vendor not found");
  return {
    vendor,
    vouchers: data.vouchers.filter((v) => v.vendorId === id),
    collections: data.collections.filter((c) => c.vendorId === id),
    currency: data.currency,
  };
}

async function assertHotspot(hotspotId: string | null | undefined, ownerId: string) {
  if (!hotspotId) return null;
  const hs = await getHotspotById(hotspotId, ownerId);
  if (!hs) throw new Error("Hotspot not found");
  return hotspotId;
}

export async function createOwnerVendor(raw: unknown) {
  const user = await requireUser();
  const data = vendorSchema.parse(raw);
  return vendorRepo.createVendor({
    ownerId: user.id,
    name: data.name,
    phone: data.phone?.trim() || null,
    hotspotId: await assertHotspot(data.hotspotId, user.id),
    commissionPercent: data.commissionPercent,
    notes: data.notes?.trim() || null,
  });
}

export async function updateOwnerVendor(id: string, raw: unknown) {
  const user = await requireUser();
  const data = vendorSchema.partial().parse(raw);
  const updated = await vendorRepo.updateVendor(id, user.id, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
    ...(data.hotspotId !== undefined
      ? { hotspotId: await assertHotspot(data.hotspotId, user.id) }
      : {}),
    ...(data.commissionPercent !== undefined
      ? { commissionPercent: data.commissionPercent }
      : {}),
    ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
  });
  if (!updated) throw new Error("Vendor not found");
  return updated;
}

export async function deleteOwnerVendor(id: string) {
  const user = await requireUser();
  const { vendor, vouchers, collections } = await getOwnerVendorDetail(id);
  if (vouchers.length || collections.length) {
    throw new Error(
      `${vendor.name} has voucher or collection history. Deactivate the vendor instead so records stay intact.`,
    );
  }
  await vendorRepo.deleteVendor(id, user.id);
}

export async function assignOwnerVouchers(raw: unknown) {
  const user = await requireUser();
  const data = vendorAssignSchema.parse(raw);
  if (data.vendorId) {
    const vendor = await vendorRepo.getVendorById(data.vendorId, user.id);
    if (!vendor) throw new Error("Vendor not found");
    if (!vendor.active) throw new Error("Vendor is inactive");
  }
  const updated = await voucherRepo.assignVouchersToVendor(
    data.voucherIds,
    user.id,
    data.vendorId,
  );
  if (!updated) {
    throw new Error("Only unused vouchers can be assigned or taken back");
  }
  return { updated, skipped: data.voucherIds.length - updated };
}

export async function recordVendorCollection(vendorId: string, raw: unknown) {
  const user = await requireUser();
  const data = vendorCollectionSchema.parse(raw);
  if (data.amount <= 0 && data.commissionAmount <= 0) {
    throw new Error("Enter cash collected or commission");
  }
  const vendor = await vendorRepo.getVendorById(vendorId, user.id);
  if (!vendor) throw new Error("Vendor not found");

  const packages = await listPackagesByOwner(user.id);
  const currency = packages[0]?.currency ?? "GHS";
  const collectedAt =
    data.collectedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  let expenseId: string | null = null;
  if (data.commissionAmount > 0) {
    const expense = await expenseRepo.createExpense({
      ownerId: user.id,
      category: VENDOR_COMMISSION_CATEGORY,
      description: `Vendor commission — ${vendor.name}`,
      amount: round2(data.commissionAmount),
      currency,
      incurredAt: collectedAt,
      notes: data.notes?.trim() || null,
      hotspotId: vendor.hotspotId,
    });
    expenseId = expense.id;
  }

  try {
    return await vendorRepo.createCollection({
      ownerId: user.id,
      vendorId,
      amount: round2(data.amount),
      commissionAmount: round2(data.commissionAmount),
      currency,
      expenseId,
      collectedAt,
      notes: data.notes?.trim() || null,
    });
  } catch (error) {
    if (expenseId) await expenseRepo.deleteExpense(expenseId, user.id);
    throw error;
  }
}

export async function deleteVendorCollection(collectionId: string) {
  const user = await requireUser();
  const collection = await vendorRepo.getCollectionById(collectionId, user.id);
  if (!collection) throw new Error("Collection not found");
  await vendorRepo.deleteCollection(collectionId, user.id);
  if (collection.expenseId) {
    await expenseRepo.deleteExpense(collection.expenseId, user.id);
  }
}
