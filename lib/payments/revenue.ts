import type { Payment, PaymentProvider } from "@/lib/types";

/** Providers that represent free unlocks, not cash sales. */
const NON_REVENUE_PROVIDERS = new Set<PaymentProvider>(["free", "roam"]);

/**
 * True when a successful payment should count toward money metrics.
 * Free Mode / roam grants are excluded (amount 0 by design).
 */
export function isMoneyPayment(p: Pick<Payment, "status" | "provider" | "amount">): boolean {
  if (p.status !== "success") return false;
  if (NON_REVENUE_PROVIDERS.has(p.provider)) return false;
  return true;
}

/**
 * Cash value of a payment for revenue totals.
 * Historical voucher redemptions were stored as amount 0 — use package price.
 */
export function paymentRevenueAmount(
  p: Pick<Payment, "amount" | "provider" | "packageId">,
  packagePriceById?: Map<string, number>,
): number {
  if (p.provider === "voucher" && p.amount <= 0 && packagePriceById) {
    const price = packagePriceById.get(p.packageId);
    if (typeof price === "number" && price > 0) return price;
  }
  return p.amount;
}
