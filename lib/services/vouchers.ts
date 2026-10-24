import * as paymentRepo from "@/lib/repositories/payments";
import { getHotspotById, listHotspotsByOwner } from "@/lib/repositories/hotspots";
import {
  getPackageById,
  listPackagesByOwner,
} from "@/lib/repositories/packages";
import { getVendorById, listVendorsByOwner } from "@/lib/repositories/vendors";
import * as voucherRepo from "@/lib/repositories/vouchers";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { resolvePortalEmail } from "@/lib/portal-guest-email";
import { hotspotHasLiveMikroTik } from "@/lib/router/session-access";
import { requireUser } from "@/lib/services/auth";
import { provisionAccessFromPayment } from "@/lib/services/payments";
import type { VoucherListItem } from "@/lib/types";
import {
  voucherBatchSchema,
  voucherRedeemSchema,
} from "@/lib/validations";

export async function listOwnerVouchers(): Promise<{
  batches: Awaited<ReturnType<typeof voucherRepo.listBatchesByOwner>>;
  vouchers: VoucherListItem[];
  /** Redeemed voucher sales total (package prices). */
  redeemedRevenue: number;
  currency: string;
}> {
  const user = await requireUser();
  const [batches, vouchers, packages, hotspots, vendors] = await Promise.all([
    voucherRepo.listBatchesByOwner(user.id),
    voucherRepo.listVouchersByOwner(user.id),
    listPackagesByOwner(user.id),
    listHotspotsByOwner(user.id),
    listVendorsByOwner(user.id).catch(() => []),
  ]);
  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const hotspotMap = new Map(hotspots.map((h) => [h.id, h]));
  const batchMap = new Map(batches.map((b) => [b.id, b]));
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const packagePriceById = new Map(packages.map((p) => [p.id, p.price]));

  const now = Date.now();
  const enriched: VoucherListItem[] = [];
  let redeemedRevenue = 0;
  for (const v of vouchers) {
    let status = v.status;
    if (
      status === "unused" &&
      v.expiresAt &&
      new Date(v.expiresAt).getTime() < now
    ) {
      status = "expired";
      await voucherRepo.updateVoucher(v.id, { status: "expired" });
    }
    if (status === "redeemed") {
      redeemedRevenue += packagePriceById.get(v.packageId) ?? 0;
    }
    enriched.push({
      ...v,
      status,
      packageName: packageMap.get(v.packageId)?.name ?? "Unknown",
      hotspotName: v.hotspotId
        ? (hotspotMap.get(v.hotspotId)?.name ?? null)
        : null,
      batchLabel: batchMap.get(v.batchId)?.label ?? "Batch",
      vendorName: v.vendorId ? (vendorMap.get(v.vendorId)?.name ?? null) : null,
      price: packagePriceById.get(v.packageId) ?? 0,
    });
  }

  const currency = packages[0]?.currency ?? "GHS";
  return { batches, vouchers: enriched, redeemedRevenue, currency };
}

export async function generateVoucherBatch(raw: unknown) {
  const user = await requireUser();
  const data = voucherBatchSchema.parse(raw);
  const pkg = await getPackageById(data.packageId, user.id);
  if (!pkg) throw new Error("Package not found");

  if (data.hotspotId) {
    const hs = await getHotspotById(data.hotspotId, user.id);
    if (!hs) throw new Error("Hotspot not found");
  }
  if (data.vendorId) {
    const vendor = await getVendorById(data.vendorId, user.id);
    if (!vendor) throw new Error("Vendor not found");
    if (!vendor.active) throw new Error("Vendor is inactive");
  }

  return voucherRepo.createVoucherBatch({
    ownerId: user.id,
    packageId: data.packageId,
    hotspotId: data.hotspotId ?? null,
    vendorId: data.vendorId ?? null,
    label: data.label,
    quantity: data.quantity,
    expiresAt: data.expiresAt
      ? new Date(`${data.expiresAt}T23:59:59.999`).toISOString()
      : null,
  });
}

export async function voidOwnerVoucher(id: string) {
  const user = await requireUser();
  const updated = await voucherRepo.voidVoucher(id, user.id);
  if (!updated) throw new Error("Voucher not found");
  return updated;
}

export async function deleteOwnerVouchers(ids: string[]) {
  const user = await requireUser();
  const cleaned = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  if (!cleaned.length) throw new Error("Select at least one voucher");
  if (cleaned.length > 500) throw new Error("Too many vouchers (max 500)");
  const deleted = await voucherRepo.deleteVouchers(cleaned, user.id);
  if (!deleted) throw new Error("No matching vouchers to delete");
  return { deleted };
}

export async function redeemVoucher(raw: unknown) {
  const data = voucherRedeemSchema.parse(raw);
  const voucher = await voucherRepo.findVoucherByCode(data.code);
  if (!voucher) throw new Error("Voucher not found");

  if (voucher.status === "redeemed") {
    throw new Error("Voucher already redeemed");
  }
  if (voucher.status === "void") {
    throw new Error("Voucher has been voided");
  }
  if (
    voucher.expiresAt &&
    new Date(voucher.expiresAt).getTime() < Date.now()
  ) {
    await voucherRepo.updateVoucher(voucher.id, { status: "expired" });
    throw new Error("Voucher has expired");
  }
  if (voucher.status !== "unused") {
    throw new Error("Voucher is not available");
  }

  const hotspot = await getHotspotById(data.hotspotId);
  if (!hotspot || hotspot.status === "inactive") {
    throw new Error("Hotspot not found or inactive");
  }
  if (hotspot.status === "maintenance") {
    throw new Error(
      "This hotspot is under maintenance. Voucher redeem is paused — try again shortly.",
    );
  }
  if (hotspot.ownerId !== voucher.ownerId) {
    throw new Error("Voucher is not valid at this hotspot");
  }
  if (voucher.hotspotId && voucher.hotspotId !== hotspot.id) {
    throw new Error("Voucher is locked to another location");
  }

  const clientMac = normalizeMac(data.macAddress);
  if (
    (await hotspotHasLiveMikroTik(hotspot.id)) &&
    !isUsableClientMac(clientMac)
  ) {
    throw new Error(
      "Connect to this hotspot’s Wi‑Fi first so your device MAC is known, then redeem again.",
    );
  }
  const email = await resolvePortalEmail(data.email, clientMac);

  const pkg = await getPackageById(voucher.packageId, voucher.ownerId);
  if (!pkg || !pkg.enabled) {
    throw new Error("Package not found or disabled");
  }

  const reference = `vf_${voucher.code.replace(/-/g, "").toLowerCase()}_${Date.now().toString(36)}`;
  const payment = await paymentRepo.createPayment({
    reference,
    hotspotId: hotspot.id,
    packageId: pkg.id,
    customerEmail: email,
    amount: pkg.price,
    currency: pkg.currency,
    provider: "voucher",
    status: "success",
    providerRef: voucher.code,
    clientMac: isUsableClientMac(clientMac) ? clientMac : null,
  });

  await voucherRepo.updateVoucher(voucher.id, {
    status: "redeemed",
    redeemedAt: new Date().toISOString(),
    redeemedByEmail: email,
    paymentId: payment.id,
  });

  // Return before MikroTik unlock so captive browsers can reach the success page
  // (same pattern as Free Mode — unlock mid-request kills the portal tab).
  const { session } = await provisionAccessFromPayment(
    payment,
    {
      notifyTitle: "Voucher redeemed",
      notifyBody: `${email} redeemed ${voucher.code} for ${pkg.name} (${pkg.currency} ${pkg.price}).`,
      href: "/vouchers",
    },
    { deferRouterUnlock: true },
  );

  return { voucher, payment, session, package: pkg, hotspot };
}
