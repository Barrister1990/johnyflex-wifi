import { runtimeEnv } from "@/lib/env/runtime";
import {
  isMoneyPayment,
  paymentRevenueAmount,
} from "@/lib/payments/revenue";
import { PaystackPaymentProvider } from "@/lib/payments/paystack";
import * as expenseRepo from "@/lib/repositories/expenses";
import { listPackagesByOwner } from "@/lib/repositories/packages";
import { requireUser } from "@/lib/services/auth";
import { listOwnerPayments } from "@/lib/services/payments";
import type {
  Expense,
  PaystackSettlementRow,
  PaystackTransactionRow,
  RevenueBucket,
  RevenueRangePreset,
  RevenueSummary,
} from "@/lib/types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolveRevenueRange(input: {
  preset?: RevenueRangePreset | string;
  from?: string;
  to?: string;
  month?: number;
  year?: number;
}): { from: Date; to: Date; fromIso: string; toIso: string } {
  const now = new Date();
  const preset = (input.preset ?? "month").toLowerCase();

  if (
    preset === "custom" &&
    input.from &&
    input.to &&
    !Number.isNaN(Date.parse(input.from)) &&
    !Number.isNaN(Date.parse(input.to))
  ) {
    const from = startOfDay(new Date(input.from));
    const to = endOfDay(new Date(input.to));
    return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
  }

  if (preset === "month" && input.month && input.year) {
    const from = startOfDay(new Date(input.year, input.month - 1, 1));
    const to = endOfDay(new Date(input.year, input.month, 0));
    return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
  }

  if (preset === "year" && input.year) {
    const from = startOfDay(new Date(input.year, 0, 1));
    const to = endOfDay(new Date(input.year, 11, 31));
    return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
  }

  if (preset === "day") {
    const from = startOfDay(now);
    const to = endOfDay(now);
    return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
  }

  if (preset === "week") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    const to = endOfDay(now);
    return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
  }

  if (preset === "year") {
    const from = startOfDay(new Date(now.getFullYear(), 0, 1));
    const to = endOfDay(now);
    return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
  }

  // default: current month
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(now);
  return { from, to, fromIso: isoDate(from), toIso: isoDate(to) };
}

function bucketKey(date: Date, preset: string): { key: string; label: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  if (preset === "year") {
    const label = date.toLocaleString("en", { month: "short", year: "numeric" });
    return { key: `${y}-${String(m + 1).padStart(2, "0")}`, label };
  }
  if (preset === "day") {
    const label = date.toLocaleString("en", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}`,
      label,
    };
  }
  const label = date.toLocaleString("en", {
    month: "short",
    day: "numeric",
  });
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    label,
  };
}

export async function getRevenueSummary(input: {
  preset?: string;
  from?: string;
  to?: string;
  month?: number;
  year?: number;
  hotspotId?: string | null;
}): Promise<RevenueSummary> {
  const user = await requireUser();
  const range = resolveRevenueRange(input);
  const preset = (input.preset ?? "month").toLowerCase();
  const siteFilter = input.hotspotId?.trim() || null;

  const [allPayments, expenses, packages] = await Promise.all([
    listOwnerPayments(user.id, siteFilter),
    expenseRepo.listExpensesByOwner(user.id, {
      from: range.fromIso,
      to: range.toIso,
      hotspotId: siteFilter,
    }),
    listPackagesByOwner(user.id),
  ]);
  const packagePriceById = new Map(packages.map((p) => [p.id, p.price]));

  const inRange = allPayments.filter((p) => {
    const t = new Date(p.createdAt).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  });

  const money = inRange.filter(isMoneyPayment);
  const failed = inRange.filter((p) => p.status === "failed");
  const pending = inRange.filter((p) => p.status === "pending");

  const amountOf = (p: (typeof money)[number]) =>
    paymentRevenueAmount(p, packagePriceById);

  const grossRevenue = money.reduce((s, p) => s + amountOf(p), 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const currency =
    money[0]?.currency ?? expenses[0]?.currency ?? "GHS";

  const map = new Map<string, RevenueBucket>();

  for (const p of money) {
    const when = new Date(p.createdAt);
    const { key, label } = bucketKey(when, preset);
    const row = map.get(key) ?? {
      key,
      label,
      revenue: 0,
      expenses: 0,
      net: 0,
      payments: 0,
    };
    row.revenue += amountOf(p);
    row.payments += 1;
    map.set(key, row);
  }

  for (const e of expenses) {
    const when = new Date(e.incurredAt);
    const { key, label } = bucketKey(when, preset === "day" ? "week" : preset);
    const row = map.get(key) ?? {
      key,
      label,
      revenue: 0,
      expenses: 0,
      net: 0,
      payments: 0,
    };
    row.expenses += e.amount;
    if (!map.has(key)) row.label = label;
    map.set(key, row);
  }

  const buckets = [...map.values()]
    .map((b) => ({ ...b, net: b.revenue - b.expenses }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const moneyWithAmounts = money.map((p) => ({
    ...p,
    amount: amountOf(p),
  }));

  return {
    from: range.fromIso,
    to: range.toIso,
    currency,
    grossRevenue,
    expenseTotal,
    netProfit: grossRevenue - expenseTotal,
    successfulPayments: money.length,
    failedPayments: failed.length,
    pendingPayments: pending.length,
    voucherRevenue: money
      .filter((p) => p.provider === "voucher")
      .reduce((s, p) => s + amountOf(p), 0),
    paystackRevenue: money
      .filter((p) => p.provider === "paystack")
      .reduce((s, p) => s + amountOf(p), 0),
    mockRevenue: money
      .filter((p) => p.provider === "mock")
      .reduce((s, p) => s + amountOf(p), 0),
    averageTicket: money.length ? grossRevenue / money.length : 0,
    buckets,
    payments: moneyWithAmounts,
    expenses,
  };
}

function paystackClient(): PaystackPaymentProvider | null {
  const secret = runtimeEnv("PAYSTACK_SECRET_KEY");
  if (!secret) return null;
  const webhook = runtimeEnv("PAYSTACK_WEBHOOK_SECRET") ?? secret;
  return new PaystackPaymentProvider(secret, webhook);
}

export async function getPaystackFinance(input: {
  from?: string;
  to?: string;
}): Promise<{
  configured: boolean;
  settlements: PaystackSettlementRow[];
  transactions: PaystackTransactionRow[];
  error?: string;
}> {
  await requireUser();
  const client = paystackClient();
  if (!client) {
    return {
      configured: false,
      settlements: [],
      transactions: [],
      error: "Add PAYSTACK_SECRET_KEY to load Paystack settlements.",
    };
  }

  try {
    const [settlements, transactions] = await Promise.all([
      client.listSettlements({
        from: input.from,
        to: input.to,
        perPage: 50,
      }),
      client.listTransactions({
        from: input.from,
        to: input.to,
        status: "success",
        perPage: 50,
      }),
    ]);
    return {
      configured: true,
      settlements: settlements.rows,
      transactions: transactions.rows,
    };
  } catch (error) {
    return {
      configured: true,
      settlements: [],
      transactions: [],
      error: error instanceof Error ? error.message : "Paystack API failed",
    };
  }
}

export async function createExpense(raw: unknown): Promise<Expense> {
  const user = await requireUser();
  const body = raw as {
    category?: string;
    description?: string;
    amount?: number;
    currency?: string;
    incurredAt?: string;
    notes?: string | null;
    hotspotId?: string | null;
  };
  if (!body.description?.trim()) throw new Error("Description required");
  if (body.amount == null || Number(body.amount) < 0) {
    throw new Error("Valid amount required");
  }
  let hotspotId: string | null = body.hotspotId?.trim() || null;
  if (hotspotId) {
    const { getHotspotById } = await import("@/lib/repositories/hotspots");
    const hs = await getHotspotById(hotspotId, user.id);
    if (!hs) throw new Error("Hotspot not found");
  }
  return expenseRepo.createExpense({
    ownerId: user.id,
    category: (body.category ?? "general").trim() || "general",
    description: body.description.trim(),
    amount: Number(body.amount),
    currency: body.currency ?? "GHS",
    incurredAt: body.incurredAt ?? isoDate(new Date()),
    notes: body.notes ?? null,
    hotspotId,
  });
}

export async function removeExpense(id: string): Promise<void> {
  const user = await requireUser();
  const expenses = await expenseRepo.listExpensesByOwner(user.id);
  if (expenses.find((e) => e.id === id)?.category === "vendor_commission") {
    throw new Error(
      "This commission belongs to a vendor collection. Delete the collection on the Vendors page instead.",
    );
  }
  await expenseRepo.deleteExpense(id, user.id);
}
