"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconPlus, IconVendors } from "@/components/icons";
import { useLocationFilter } from "@/components/location-provider";
import { VoucherPrintSheet } from "@/components/vouchers/voucher-print-sheet";
import { isAllLocations, LOCATION_ALL } from "@/lib/location-filter";
import type {
  Package,
  VendorCollection,
  VendorWithStats,
  VoucherListItem,
} from "@/lib/types";

type Totals = {
  stockValue: number;
  salesValue: number;
  collected: number;
  commission: number;
  balance: number;
};

type Detail = {
  vendor: VendorWithStats;
  vouchers: VoucherListItem[];
  collections: VendorCollection[];
};

const EMPTY_TOTALS: Totals = {
  stockValue: 0,
  salesValue: 0,
  collected: 0,
  commission: 0,
  balance: 0,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function money(currency: string, n: number) {
  return `${currency} ${n.toLocaleString("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const emptyVendorForm = {
  name: "",
  phone: "",
  hotspotId: LOCATION_ALL as string,
  commissionPercent: "10",
  notes: "",
};

export default function VendorsPage() {
  const toast = useToast();
  const { locationId, hotspots } = useLocationFilter();
  const [vendors, setVendors] = useState<VendorWithStats[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [currency, setCurrency] = useState("GHS");
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [vendorModal, setVendorModal] = useState<"add" | "edit" | null>(null);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [savingVendor, setSavingVendor] = useState(false);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [collectOpen, setCollectOpen] = useState(false);
  const [collectForm, setCollectForm] = useState({
    amount: "",
    commissionAmount: "",
    collectedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [savingCollect, setSavingCollect] = useState(false);
  const [printIds, setPrintIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = isAllLocations(locationId) ? "" : `?hotspotId=${locationId}`;
    const [vRes, pRes] = await Promise.all([
      fetch(`/api/vendors${qs}`),
      fetch("/api/packages"),
    ]);
    const vData = await vRes.json();
    const pData = await pRes.json().catch(() => ({}));
    if (vRes.ok) {
      setVendors(vData.vendors ?? []);
      setTotals(vData.totals ?? EMPTY_TOTALS);
      setCurrency(vData.currency || "GHS");
    } else {
      toast.error("Could not load vendors", vData.error);
    }
    if (pRes.ok) setPackages(pData.packages ?? []);
    setLoading(false);
  }, [locationId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onAfterPrint() {
      setPrintIds([]);
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true);
    const res = await fetch(`/api/vendors/${id}`);
    const data = await res.json();
    setDetailLoading(false);
    if (!res.ok) {
      toast.error("Could not load vendor", data.error);
      return;
    }
    setDetail(data);
  }

  async function refreshAll() {
    const id = detail?.vendor.id;
    await load();
    if (id) await openDetail(id);
  }

  const visibleVendors = useMemo(
    () => vendors.filter((v) => showInactive || v.active),
    [vendors, showInactive],
  );

  function openAddVendor() {
    setVendorForm({
      ...emptyVendorForm,
      hotspotId: isAllLocations(locationId) ? LOCATION_ALL : locationId,
    });
    setVendorModal("add");
  }

  function openEditVendor(v: VendorWithStats) {
    setVendorForm({
      name: v.name,
      phone: v.phone ?? "",
      hotspotId: v.hotspotId ?? LOCATION_ALL,
      commissionPercent: String(v.commissionPercent),
      notes: v.notes ?? "",
    });
    setVendorModal("edit");
  }

  async function onSaveVendor(e: FormEvent) {
    e.preventDefault();
    setSavingVendor(true);
    const payload = {
      name: vendorForm.name,
      phone: vendorForm.phone || null,
      hotspotId: isAllLocations(vendorForm.hotspotId)
        ? null
        : vendorForm.hotspotId,
      commissionPercent: Number(vendorForm.commissionPercent) || 0,
      notes: vendorForm.notes || null,
    };
    const editing = vendorModal === "edit" && detail;
    const res = await fetch(
      editing ? `/api/vendors/${detail.vendor.id}` : "/api/vendors",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    setSavingVendor(false);
    if (!res.ok) {
      toast.error("Could not save vendor", data.error);
      return;
    }
    toast.success(editing ? "Vendor updated" : "Vendor added", payload.name);
    setVendorModal(null);
    await refreshAll();
  }

  async function toggleActive(v: VendorWithStats) {
    const res = await fetch(`/api/vendors/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !v.active }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not update vendor", data.error);
    else {
      toast.success(v.active ? "Vendor deactivated" : "Vendor reactivated");
      await refreshAll();
    }
  }

  async function deleteVendor(v: VendorWithStats) {
    if (!window.confirm(`Delete ${v.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/vendors/${v.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not delete", data.error);
      return;
    }
    toast.success("Vendor deleted");
    setDetail(null);
    await load();
  }

  function openCollect() {
    if (!detail) return;
    const { stats, commissionPercent } = detail.vendor;
    const outstanding = Math.max(0, stats.balance);
    const commission = round2((outstanding * commissionPercent) / 100);
    setCollectForm({
      amount: String(round2(outstanding - commission)),
      commissionAmount: String(commission),
      collectedAt: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setCollectOpen(true);
  }

  async function onSaveCollect(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSavingCollect(true);
    const res = await fetch(`/api/vendors/${detail.vendor.id}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(collectForm.amount) || 0,
        commissionAmount: Number(collectForm.commissionAmount) || 0,
        collectedAt: collectForm.collectedAt,
        notes: collectForm.notes || null,
      }),
    });
    const data = await res.json();
    setSavingCollect(false);
    if (!res.ok) {
      toast.error("Could not record collection", data.error);
      return;
    }
    toast.success(
      "Collection recorded",
      Number(collectForm.commissionAmount) > 0
        ? "Commission saved to Expenses."
        : undefined,
    );
    setCollectOpen(false);
    await refreshAll();
  }

  async function deleteCollection(c: VendorCollection) {
    if (
      !window.confirm(
        "Delete this collection? Its commission expense will be removed too.",
      )
    ) {
      return;
    }
    const res = await fetch(`/api/vendor-collections/${c.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not delete", data.error);
    else {
      toast.success("Collection deleted");
      await refreshAll();
    }
  }

  async function takeBack(ids: string[]) {
    if (!ids.length) return;
    if (
      !window.confirm(
        `Take back ${ids.length} unsold voucher${ids.length === 1 ? "" : "s"} from this vendor?`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/vouchers/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherIds: ids, vendorId: null }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not take back", data.error);
    else {
      toast.success("Vouchers returned", `${data.updated} back in stock.`);
      await refreshAll();
    }
  }

  function printUnsold() {
    if (!detail) return;
    const ids = detail.vouchers
      .filter((v) => v.status === "unused")
      .map((v) => v.id);
    if (!ids.length) {
      toast.error("Nothing to print", "This vendor has no unsold vouchers.");
      return;
    }
    setPrintIds(ids);
    requestAnimationFrame(() => window.print());
  }

  const printList = useMemo(
    () => (detail?.vouchers ?? []).filter((v) => printIds.includes(v.id)),
    [detail, printIds],
  );

  const collectPreview = useMemo(() => {
    const cash = Number(collectForm.amount) || 0;
    const commission = Number(collectForm.commissionAmount) || 0;
    const balance = detail?.vendor.stats.balance ?? 0;
    return { settled: cash + commission, after: round2(balance - cash - commission) };
  }, [collectForm, detail]);

  const unsoldIds =
    detail?.vouchers.filter((v) => v.status === "unused").map((v) => v.id) ??
    [];

  return (
    <>
      <div className="space-y-4 print:hidden md:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
              Resellers
            </p>
            <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
              Vendors
            </h1>
            <p className="mt-0.5 max-w-xl text-2xs text-secondary md:text-xs-tight">
              Track printed vouchers given to vendors, what they have sold, cash
              collected, and what they still owe. Commission is logged as an
              expense.
            </p>
          </div>
          <Button size="sm" className="gap-1" onClick={openAddVendor}>
            <IconPlus className="h-3.5 w-3.5" />
            Add vendor
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:gap-3">
          <SummaryCard
            tone="bg-land-yellow"
            label="Stock with vendors"
            value={money(currency, totals.stockValue)}
          />
          <SummaryCard
            tone="bg-land-blue"
            label="Sold (redeemed)"
            value={money(currency, totals.salesValue)}
          />
          <SummaryCard
            tone="bg-success/15"
            label="Cash collected"
            value={money(currency, totals.collected)}
          />
          <SummaryCard
            tone="bg-land-lavender"
            label="Commission paid"
            value={money(currency, totals.commission)}
          />
          <SummaryCard
            tone="bg-land-pink"
            label="Outstanding"
            value={money(currency, totals.balance)}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-2xs text-muted">
            {visibleVendors.length} vendor{visibleVendors.length === 1 ? "" : "s"}
          </p>
          <label className="flex items-center gap-2 text-2xs text-secondary">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-inset/70" />
        ) : visibleVendors.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
            <IconVendors className="h-5 w-5 text-muted" />
            <p className="mt-3 text-xs-tight font-semibold">No vendors yet</p>
            <p className="mt-1 max-w-sm text-2xs text-muted">
              Add the shops or people who sell your printed vouchers, then
              assign vouchers to them from the Vouchers page.
            </p>
            <Button size="sm" className="mt-4" onClick={openAddVendor}>
              Add vendor
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-canvas md:rounded-2xl">
            <ul className="divide-y divide-border">
              {visibleVendors.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(v.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-surface md:px-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs-tight font-semibold md:text-sm">
                        {v.name}
                        {!v.active ? (
                          <span className="ml-2 rounded-full bg-inset px-2 py-0.5 text-[9px] font-semibold text-muted">
                            Inactive
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-2xs text-muted">
                        {v.phone ? `${v.phone} · ` : ""}
                        {v.hotspotName ?? "All locations"} ·{" "}
                        {v.commissionPercent}% commission
                      </p>
                      <p className="mt-0.5 text-2xs text-secondary">
                        {v.stats.vouchersGiven} given · {v.stats.vouchersSold}{" "}
                        sold · {v.stats.vouchersUnsold} unsold
                      </p>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Sold
                        </p>
                        <p className="text-xs-tight font-semibold">
                          {money(currency, v.stats.salesValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Collected
                        </p>
                        <p className="text-xs-tight font-semibold">
                          {money(currency, v.stats.collected)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Owes
                        </p>
                        <p
                          className={`text-xs-tight font-semibold ${
                            v.stats.balance > 0 ? "text-danger" : "text-success"
                          }`}
                        >
                          {money(currency, v.stats.balance)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-2xs text-muted">
          Give vouchers to a vendor from{" "}
          <Link href="/vouchers" className="underline">
            Vouchers
          </Link>{" "}
          (select codes → Assign to vendor), or pick a vendor when generating a
          batch.
        </p>
      </div>

      <Modal
        open={detail != null || detailLoading}
        onClose={() => setDetail(null)}
        title={detail?.vendor.name ?? "Loading…"}
        description={
          detail
            ? `${detail.vendor.hotspotName ?? "All locations"} · ${detail.vendor.commissionPercent}% commission${detail.vendor.phone ? ` · ${detail.vendor.phone}` : ""}`
            : undefined
        }
        size="lg"
        footer={
          detail ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => void deleteVendor(detail.vendor)}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void toggleActive(detail.vendor)}
              >
                {detail.vendor.active ? "Deactivate" : "Reactivate"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openEditVendor(detail.vendor)}
              >
                Edit
              </Button>
              <Button size="sm" onClick={openCollect}>
                Record collection
              </Button>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Vouchers given" value={String(detail.vendor.stats.vouchersGiven)} />
              <Stat label="Sold" value={String(detail.vendor.stats.vouchersSold)} />
              <Stat label="Unsold (stock)" value={`${detail.vendor.stats.vouchersUnsold} · ${money(currency, detail.vendor.stats.stockValue)}`} />
              <Stat label="Sales value" value={money(currency, detail.vendor.stats.salesValue)} />
              <Stat label={`Commission (${detail.vendor.commissionPercent}%)`} value={money(currency, detail.vendor.stats.commissionDue)} />
              <Stat label="Expected cash" value={money(currency, detail.vendor.stats.expectedCash)} />
              <Stat label="Cash collected" value={money(currency, detail.vendor.stats.collected)} />
              <Stat label="Commission recorded" value={money(currency, detail.vendor.stats.commissionRecorded)} />
              <Stat
                label="Balance owed"
                value={money(currency, detail.vendor.stats.balance)}
                tone={detail.vendor.stats.balance > 0 ? "text-danger" : "text-success"}
              />
            </div>

            <section>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs-tight font-semibold">Collections</h3>
              </div>
              {detail.collections.length === 0 ? (
                <p className="mt-2 text-2xs text-muted">
                  No money collected yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {detail.collections.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs-tight font-semibold">
                          {money(c.currency, c.amount)} cash
                          {c.commissionAmount > 0
                            ? ` + ${money(c.currency, c.commissionAmount)} commission`
                            : ""}
                        </p>
                        <p className="text-2xs text-muted">
                          {c.collectedAt}
                          {c.notes ? ` · ${c.notes}` : ""}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => void deleteCollection(c)}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs-tight font-semibold">
                  Vouchers ({detail.vouchers.length})
                </h3>
                <div className="flex gap-1.5">
                  <Button size="xs" variant="secondary" onClick={printUnsold}>
                    Print unsold
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={!unsoldIds.length}
                    onClick={() => void takeBack(unsoldIds)}
                  >
                    Take back unsold
                  </Button>
                </div>
              </div>
              {detail.vouchers.length === 0 ? (
                <p className="mt-2 text-2xs text-muted">
                  No vouchers assigned. Use Vouchers → select → Assign to vendor.
                </p>
              ) : (
                <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {detail.vouchers.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs-tight font-bold">
                          {v.code}
                        </p>
                        <p className="text-2xs text-muted">
                          {v.packageName} · {money(currency, v.price)}
                          {v.redeemedAt
                            ? ` · sold ${v.redeemedAt.slice(0, 10)}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${
                          v.status === "redeemed"
                            ? "bg-success/10 text-success"
                            : "bg-inset text-secondary"
                        }`}
                      >
                        {v.status === "redeemed" ? "sold" : v.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <div className="h-32 animate-pulse rounded-xl bg-inset/70" />
        )}
      </Modal>

      <Modal
        open={collectOpen}
        onClose={() => !savingCollect && setCollectOpen(false)}
        title="Record collection"
        description={
          detail
            ? `${detail.vendor.name} owes ${money(currency, detail.vendor.stats.balance)} in sales.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={savingCollect}
              onClick={() => setCollectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="collect-form"
              size="sm"
              disabled={savingCollect}
            >
              {savingCollect ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="collect-form" onSubmit={onSaveCollect} className="space-y-3">
          <Input
            label={`Cash received (${currency})`}
            type="number"
            min={0}
            step="0.01"
            value={collectForm.amount}
            onChange={(e) =>
              setCollectForm({ ...collectForm, amount: e.target.value })
            }
            required
          />
          <Input
            label={`Commission kept by vendor (${currency})`}
            type="number"
            min={0}
            step="0.01"
            value={collectForm.commissionAmount}
            onChange={(e) =>
              setCollectForm({
                ...collectForm,
                commissionAmount: e.target.value,
              })
            }
          />
          <Input
            label="Date"
            type="date"
            value={collectForm.collectedAt}
            onChange={(e) =>
              setCollectForm({ ...collectForm, collectedAt: e.target.value })
            }
            required
          />
          <Input
            label="Notes (optional)"
            value={collectForm.notes}
            onChange={(e) =>
              setCollectForm({ ...collectForm, notes: e.target.value })
            }
            placeholder="MoMo ref, who handed it over…"
          />
          <div className="rounded-xl bg-inset px-3 py-2 text-2xs text-secondary">
            Settles {money(currency, collectPreview.settled)} of sales. Balance
            after: <strong>{money(currency, collectPreview.after)}</strong>.
            Commission is saved to Expenses automatically.
          </div>
        </form>
      </Modal>

      <Modal
        open={vendorModal != null}
        onClose={() => !savingVendor && setVendorModal(null)}
        title={vendorModal === "edit" ? "Edit vendor" : "Add vendor"}
        size="sm"
        footer={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={savingVendor}
              onClick={() => setVendorModal(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="vendor-form"
              size="sm"
              disabled={savingVendor}
            >
              {savingVendor ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="vendor-form" onSubmit={onSaveVendor} className="space-y-3">
          <Input
            label="Name"
            value={vendorForm.name}
            onChange={(e) =>
              setVendorForm({ ...vendorForm, name: e.target.value })
            }
            placeholder="Auntie Ama provisions"
            required
          />
          <Input
            label="Phone (optional)"
            value={vendorForm.phone}
            onChange={(e) =>
              setVendorForm({ ...vendorForm, phone: e.target.value })
            }
            placeholder="024 000 0000"
          />
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium">Location</span>
            <select
              className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
              value={vendorForm.hotspotId}
              onChange={(e) =>
                setVendorForm({ ...vendorForm, hotspotId: e.target.value })
              }
            >
              <option value={LOCATION_ALL}>All locations</option>
              {hotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <span className="text-2xs text-muted">
              Commission expenses are booked to this location.
            </span>
          </label>
          <Input
            label="Commission %"
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={vendorForm.commissionPercent}
            onChange={(e) =>
              setVendorForm({
                ...vendorForm,
                commissionPercent: e.target.value,
              })
            }
            required
          />
          <Input
            label="Notes (optional)"
            value={vendorForm.notes}
            onChange={(e) =>
              setVendorForm({ ...vendorForm, notes: e.target.value })
            }
          />
        </form>
      </Modal>

      <VoucherPrintSheet vouchers={printList} packages={packages} />
    </>
  );
}

function SummaryCard({
  tone,
  label,
  value,
}: {
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-xl p-3 md:rounded-2xl md:p-4 ${tone}`}>
      <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-land-ink md:text-metric">
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-xs-tight font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
