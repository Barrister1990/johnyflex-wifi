"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useLocationFilter } from "@/components/location-provider";
import { isAllLocations } from "@/lib/location-filter";
import type {
  Expense,
  PaystackSettlementRow,
  PaystackTransactionRow,
  RevenueSummary,
} from "@/lib/types";

type Tab = "overview" | "payments" | "paystack" | "expenses";

type Preset = "day" | "week" | "month" | "year" | "custom";

function money(currency: string, n: number) {
  return `${currency} ${n.toFixed(2)}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function RevenuePage() {
  const toast = useToast();
  const { locationId } = useLocationFilter();
  const now = new Date();
  const [tab, setTab] = useState<Tab>("overview");
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paystack, setPaystack] = useState<{
    configured: boolean;
    settlements: PaystackSettlementRow[];
    transactions: PaystackTransactionRow[];
    error?: string;
  } | null>(null);
  const [reviewPayment, setReviewPayment] = useState<
    RevenueSummary["payments"][number] | null
  >(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "operations",
    description: "",
    amount: "",
    incurredAt: new Date().toISOString().slice(0, 10),
    notes: "",
    hotspotId: "",
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expenseHotspots, setExpenseHotspots] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/hotspots");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.hotspots)) {
        setExpenseHotspots(
          data.hotspots.map((h: { id: string; name: string }) => ({
            id: h.id,
            name: h.name,
          })),
        );
      }
    })();
  }, []);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set("preset", preset);
    if (preset === "custom") {
      if (from) q.set("from", from);
      if (to) q.set("to", to);
    } else if (preset === "month") {
      q.set("month", String(month));
      q.set("year", String(year));
    } else if (preset === "year") {
      q.set("year", String(year));
    }
    if (!isAllLocations(locationId)) q.set("hotspotId", locationId);
    return q.toString();
  }, [preset, from, to, month, year, locationId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [sumRes, psRes] = await Promise.all([
      fetch(`/api/revenue?${query}`),
      fetch(`/api/revenue/paystack?${query}`),
    ]);
    const sum = await sumRes.json();
    const ps = await psRes.json();
    if (sumRes.ok) setSummary(sum.summary);
    else toast.error("Could not load revenue", sum.error);
    if (psRes.ok) setPaystack(ps);
    setLoading(false);
  }, [query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExportPdf() {
    setExporting(true);
    try {
      const res = await fetch(`/api/revenue/export?${query}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("PDF export failed", data.error);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wifihub-financial-${summary?.from ?? "report"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded", "Ready for audit / bank use.");
    } finally {
      setExporting(false);
    }
  }

  async function onAddExpense(e: FormEvent) {
    e.preventDefault();
    setSavingExpense(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: expenseForm.category,
        description: expenseForm.description,
        amount: Number(expenseForm.amount),
        incurredAt: expenseForm.incurredAt,
        notes: expenseForm.notes || null,
        hotspotId: expenseForm.hotspotId || null,
      }),
    });
    const data = await res.json();
    setSavingExpense(false);
    if (!res.ok) {
      toast.error("Could not save expense", data.error);
      return;
    }
    toast.success("Expense recorded");
    setExpenseOpen(false);
    setExpenseForm({
      category: "operations",
      description: "",
      amount: "",
      incurredAt: new Date().toISOString().slice(0, 10),
      notes: "",
      hotspotId: isAllLocations(locationId) ? "" : locationId,
    });
    await load();
  }

  async function onDeleteExpense(exp: Expense) {
    const res = await fetch(`/api/expenses?id=${encodeURIComponent(exp.id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Delete failed", data.error);
      return;
    }
    toast.success("Expense removed");
    await load();
  }

  const currency = summary?.currency ?? "GHS";

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">
            Finance
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Revenue
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Hotspot income, Paystack payouts, expenses, and exportable
            statements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setExpenseOpen(true)}
          >
            Record expense
          </Button>
          <Button
            size="sm"
            onClick={() => void onExportPdf()}
            disabled={exporting || !summary}
          >
            {exporting ? "Preparing PDF…" : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Period controls */}
      <div className="rounded-2xl border border-border bg-canvas p-3 md:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["day", "Today"],
              ["week", "7 days"],
              ["month", "Month"],
              ["year", "Year"],
              ["custom", "Custom"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              className={`rounded-full px-3 py-1.5 text-2xs font-semibold ${
                preset === id
                  ? "bg-primary text-white"
                  : "bg-inset text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {preset === "month" ? (
            <>
              <label className="flex flex-col gap-1 text-2xs">
                <span className="text-muted">Month</span>
                <select
                  className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-2xs">
                <span className="text-muted">Year</span>
                <input
                  type="number"
                  className="w-24 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </label>
            </>
          ) : null}
          {preset === "year" ? (
            <label className="flex flex-col gap-1 text-2xs">
              <span className="text-muted">Year</span>
              <input
                type="number"
                className="w-24 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
          ) : null}
          {preset === "custom" ? (
            <>
              <Input
                label="From"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Apply
          </Button>
        </div>
        {summary ? (
          <p className="mt-2 text-2xs text-muted">
            Showing {summary.from} → {summary.to}
            {loading ? " · refreshing…" : ""}
          </p>
        ) : null}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {[
          {
            label: "Gross revenue",
            value: money(currency, summary?.grossRevenue ?? 0),
            tone: "bg-land-yellow",
          },
          {
            label: "Expenses",
            value: money(currency, summary?.expenseTotal ?? 0),
            tone: "bg-land-blue",
          },
          {
            label: "Net profit",
            value: money(currency, summary?.netProfit ?? 0),
            tone: "bg-inset",
          },
          {
            label: "Successful txns",
            value: String(summary?.successfulPayments ?? 0),
            tone: "bg-land-yellow/70",
          },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl ${k.tone} p-3 md:p-4`}>
            <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
              {k.label}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-land-ink md:text-xl">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-full bg-inset/80 p-0.5">
        {(
          [
            ["overview", "Overview"],
            ["payments", "Payments"],
            ["paystack", "Paystack"],
            ["expenses", "Expenses"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-2xs font-semibold ${
              tab === id ? "bg-primary text-white" : "text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && summary ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-canvas p-3 md:p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Revenue vs expenses
            </p>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.buckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#c4a35a" />
                  <Bar dataKey="expenses" name="Expenses" fill="#7aa2c7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-3">
              <p className="text-2xs text-muted">Paystack</p>
              <p className="mt-1 font-semibold tabular-nums">
                {money(currency, summary.paystackRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-2xs text-muted">Vouchers</p>
              <p className="mt-1 font-semibold tabular-nums">
                {money(currency, summary.voucherRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-2xs text-muted">Avg ticket</p>
              <p className="mt-1 font-semibold tabular-nums">
                {money(currency, summary.averageTicket)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "payments" && summary ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-2xs md:text-xs">
            <thead className="bg-inset text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Reference</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {summary.payments.map((p) => (
                <tr key={p.id} className="border-t border-border/70">
                  <td className="px-3 py-2 tabular-nums">
                    {p.createdAt.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 font-mono">{p.reference}</td>
                  <td className="px-3 py-2">{p.customerEmail}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">
                    {money(p.currency, p.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="font-semibold text-accent underline"
                      onClick={() => setReviewPayment(p)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {summary.payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted"
                  >
                    No successful payments in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "paystack" ? (
        <div className="space-y-4">
          {!paystack?.configured ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              Set <code className="rounded bg-white/60 px-1">PAYSTACK_SECRET_KEY</code>{" "}
              to load settlements and Paystack transactions.
            </div>
          ) : null}
          {paystack?.error ? (
            <p className="text-sm text-danger">{paystack.error}</p>
          ) : null}
          <div>
            <h2 className="text-sm font-semibold">Settlements (payouts)</h2>
            <div className="mt-2 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-left text-2xs">
                <thead className="bg-inset text-muted">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Effective</th>
                    <th className="px-3 py-2">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {(paystack?.settlements ?? []).map((s) => (
                    <tr key={s.id} className="border-t border-border/70">
                      <td className="px-3 py-2 font-mono">{s.id}</td>
                      <td className="px-3 py-2">{s.status}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {money(s.currency, s.effectiveAmount || s.amount)}
                      </td>
                      <td className="px-3 py-2">
                        {(s.settlementDate ?? s.payoutDate ?? "—").slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                  {(paystack?.settlements?.length ?? 0) === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-muted"
                      >
                        No settlements returned for this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Paystack transactions</h2>
            <div className="mt-2 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-left text-2xs">
                <thead className="bg-inset text-muted">
                  <tr>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {(paystack?.transactions ?? []).map((t) => (
                    <tr key={t.id} className="border-t border-border/70">
                      <td className="px-3 py-2">
                        {(t.paidAt ?? "—").slice(0, 10)}
                      </td>
                      <td className="px-3 py-2 font-mono">{t.reference}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {money(t.currency, t.amount)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {money(t.currency, t.fees)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "expenses" && summary ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-2xs">
            <thead className="bg-inset text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {summary.expenses.map((e) => (
                <tr key={e.id} className="border-t border-border/70">
                  <td className="px-3 py-2">{e.incurredAt.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    {e.category === "vendor_commission"
                      ? "Vendor commission"
                      : e.category}
                  </td>
                  <td className="px-3 py-2">{e.description}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {money(e.currency, e.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-danger underline"
                      onClick={() => void onDeleteExpense(e)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {summary.expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted"
                  >
                    No expenses in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Payment review (screen-in-screen) */}
      <Modal
        open={Boolean(reviewPayment)}
        onClose={() => setReviewPayment(null)}
        title="Payment review"
        size="md"
      >
        {reviewPayment ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-2 text-2xs">
              <div>
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono font-semibold">
                  {reviewPayment.reference}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Amount</dt>
                <dd className="font-semibold tabular-nums">
                  {money(reviewPayment.currency, reviewPayment.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Customer</dt>
                <dd>{reviewPayment.customerEmail}</dd>
              </div>
              <div>
                <dt className="text-muted">Provider</dt>
                <dd className="capitalize">{reviewPayment.provider}</dd>
              </div>
              <div>
                <dt className="text-muted">Package</dt>
                <dd>{reviewPayment.packageName}</dd>
              </div>
              <div>
                <dt className="text-muted">Hotspot</dt>
                <dd>{reviewPayment.hotspotName}</dd>
              </div>
              <div>
                <dt className="text-muted">Paid at</dt>
                <dd>{new Date(reviewPayment.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted">Provider ref</dt>
                <dd className="font-mono">
                  {reviewPayment.providerRef ?? "—"}
                </dd>
              </div>
            </dl>
            <p className="text-2xs text-muted">
              Use this detail view when reconciling against Paystack or bank
              deposits. Export the full period PDF for auditors.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Record expense"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExpenseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              form="expense-form"
              type="submit"
              disabled={savingExpense}
            >
              {savingExpense ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        <form id="expense-form" className="space-y-3" onSubmit={onAddExpense}>
          <label className="flex flex-col gap-1 text-2xs">
            <span className="text-muted">Category</span>
            <select
              className="rounded-xl border border-border px-3 py-2 text-sm"
              value={expenseForm.category}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, category: e.target.value })
              }
            >
              <option value="operations">Operations</option>
              <option value="connectivity">Connectivity / Starlink</option>
              <option value="equipment">Equipment</option>
              <option value="staff">Staff</option>
              <option value="rent">Rent / utilities</option>
              <option value="marketing">Marketing</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Input
            label="Description"
            required
            value={expenseForm.description}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, description: e.target.value })
            }
          />
          <label className="flex flex-col gap-1 text-2xs">
            <span className="text-muted">Location (optional)</span>
            <select
              className="rounded-xl border border-border px-3 py-2 text-sm"
              value={expenseForm.hotspotId}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, hotspotId: e.target.value })
              }
            >
              <option value="">All locations / unassigned</option>
              {expenseHotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Amount (GHS)"
            type="number"
            step="0.01"
            min="0"
            required
            value={expenseForm.amount}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, amount: e.target.value })
            }
          />
          <Input
            label="Date"
            type="date"
            required
            value={expenseForm.incurredAt}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, incurredAt: e.target.value })
            }
          />
          <Input
            label="Notes (optional)"
            value={expenseForm.notes}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, notes: e.target.value })
            }
          />
        </form>
      </Modal>
    </div>
  );
}
