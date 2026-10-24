"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconPackages, IconPlus } from "@/components/icons";
import { useLocationFilter } from "@/components/location-provider";
import { VoucherPrintSheet } from "@/components/vouchers/voucher-print-sheet";
import { isAllLocations, LOCATION_ALL } from "@/lib/location-filter";
import type {
  Package,
  VoucherBatch,
  VoucherListItem,
} from "@/lib/types";

type StatusFilter = "all" | "unused" | "redeemed" | "void" | "expired";

export default function VouchersPage() {
  const toast = useToast();
  const { locationId, hotspots: locationHotspots } = useLocationFilter();
  const [vouchers, setVouchers] = useState<VoucherListItem[]>([]);
  const [batches, setBatches] = useState<VoucherBatch[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [hotspots, setHotspots] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Café counter pack");
  const [packageId, setPackageId] = useState("");
  const [batchHotspotId, setBatchHotspotId] = useState<string>(LOCATION_ALL);
  const [quantity, setQuantity] = useState("10");
  const [expiresAt, setExpiresAt] = useState("");
  const [printIds, setPrintIds] = useState<string[]>([]);
  const [redeemedRevenue, setRedeemedRevenue] = useState(0);
  const [currency, setCurrency] = useState("GHS");
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [batchVendorId, setBatchVendorId] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVendorId, setAssignVendorId] = useState("");

  async function load() {
    setLoading(true);
    const [vRes, pRes, hRes, vendRes] = await Promise.all([
      fetch("/api/vouchers"),
      fetch("/api/packages"),
      fetch("/api/hotspots"),
      fetch("/api/vendors"),
    ]);
    const vData = await vRes.json();
    const pData = await pRes.json();
    const hData = await hRes.json().catch(() => ({}));
    const vendData = await vendRes.json().catch(() => ({}));
    if (vendRes.ok && Array.isArray(vendData.vendors)) {
      setVendors(
        vendData.vendors
          .filter((v: { active: boolean }) => v.active)
          .map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })),
      );
    }
    if (vRes.ok) {
      setVouchers(vData.vouchers);
      setBatches(vData.batches);
      setRedeemedRevenue(Number(vData.redeemedRevenue) || 0);
      setCurrency(vData.currency || "GHS");
      setSelected(new Set());
    } else toast.error("Could not load vouchers", vData.error);
    if (pRes.ok) {
      setPackages(pData.packages);
      setPackageId((prev) => prev || pData.packages[0]?.id || "");
    }
    if (hRes.ok && Array.isArray(hData.hotspots)) {
      setHotspots(
        hData.hotspots.map((h: { id: string; name: string }) => ({
          id: h.id,
          name: h.name,
        })),
      );
    } else if (locationHotspots.length) {
      setHotspots(locationHotspots.map((h) => ({ id: h.id, name: h.name })));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onAfterPrint() {
      setPrintIds([]);
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const locationScoped = useMemo(() => {
    if (isAllLocations(locationId)) return vouchers;
    return vouchers.filter(
      (v) => !v.hotspotId || v.hotspotId === locationId,
    );
  }, [vouchers, locationId]);

  const locationScopedBatches = useMemo(() => {
    if (isAllLocations(locationId)) return batches;
    return batches.filter(
      (b) => !b.hotspotId || b.hotspotId === locationId,
    );
  }, [batches, locationId]);

  const stats = useMemo(() => {
    const unused = locationScoped.filter((v) => v.status === "unused").length;
    const redeemed = locationScoped.filter((v) => v.status === "redeemed").length;
    const packagePriceById = new Map(packages.map((p) => [p.id, p.price]));
    const sales = locationScoped
      .filter((v) => v.status === "redeemed")
      .reduce((sum, v) => sum + (packagePriceById.get(v.packageId) ?? 0), 0);
    return {
      total: locationScoped.length,
      unused,
      redeemed,
      batches: locationScopedBatches.length,
      sales: isAllLocations(locationId) ? redeemedRevenue || sales : sales,
    };
  }, [locationScoped, locationScopedBatches, packages, locationId, redeemedRevenue]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locationScoped.filter((v) => {
      if (filter !== "all" && v.status !== filter) return false;
      if (!q) return true;
      return (
        v.code.toLowerCase().includes(q) ||
        v.packageName.toLowerCase().includes(q) ||
        v.batchLabel.toLowerCase().includes(q) ||
        (v.hotspotName?.toLowerCase().includes(q) ?? false) ||
        (v.vendorName?.toLowerCase().includes(q) ?? false) ||
        (v.redeemedByEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [locationScoped, filter, query]);

  const selectedCount = selected.size;

  const printList = useMemo(
    () => vouchers.filter((v) => printIds.includes(v.id)),
    [vouchers, printIds],
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const v of filtered) next.delete(v.id);
      } else {
        for (const v of filtered) next.add(v.id);
      }
      return next;
    });
  }

  function printSelection(ids: string[]) {
    if (!ids.length) {
      toast.error("Nothing to print", "Select at least one voucher.");
      return;
    }
    setPrintIds(ids);
    requestAnimationFrame(() => {
      window.print();
    });
  }

  async function deleteIds(ids: string[]) {
    if (!ids.length) return;
    const ok = window.confirm(
      `Delete ${ids.length} voucher${ids.length === 1 ? "" : "s"} permanently? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/vouchers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not delete", data.error);
    else {
      toast.success(
        "Deleted",
        `${data.deleted} voucher${data.deleted === 1 ? "" : "s"} removed.`,
      );
      await load();
    }
    setBusy(false);
  }

  function openGenerateModal() {
    setBatchHotspotId(
      isAllLocations(locationId) ? LOCATION_ALL : locationId,
    );
    setModalOpen(true);
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        packageId,
        quantity: Number(quantity),
        expiresAt: expiresAt || null,
        hotspotId: isAllLocations(batchHotspotId) ? null : batchHotspotId,
        vendorId: batchVendorId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not generate", data.error);
    else {
      toast.success(
        "Vouchers created",
        `${data.vouchers.length} codes ready to sell.`,
      );
      setModalOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function assignSelected(e: FormEvent) {
    e.preventDefault();
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    const res = await fetch("/api/vouchers/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voucherIds: ids,
        vendorId: assignVendorId || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not assign", data.error);
      return;
    }
    const vendorName = vendors.find((v) => v.id === assignVendorId)?.name;
    toast.success(
      vendorName ? `Given to ${vendorName}` : "Taken back",
      `${data.updated} voucher${data.updated === 1 ? "" : "s"}${
        data.skipped ? ` · ${data.skipped} skipped (not unused)` : ""
      }`,
    );
    setAssignOpen(false);
    await load();
  }

  async function voidCode(id: string) {
    const res = await fetch(`/api/vouchers/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void" }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not void", data.error);
    else {
      toast.success("Voucher voided");
      await load();
    }
  }

  function exportCsv() {
    const rows = [
      ["code", "status", "package", "batch", "vendor", "expiresAt", "redeemedBy"].join(","),
      ...filtered.map((v) =>
        [
          v.code,
          v.status,
          v.packageName,
          v.batchLabel,
          v.vendorName ?? "",
          v.expiresAt ?? "",
          v.redeemedByEmail ?? "",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wifihub-vouchers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="space-y-4 print:hidden md:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
              Resellers
            </p>
            <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
              Vouchers
            </h1>
            <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
              Generate, select, print (40 small tickets / A4), or delete codes for offline sales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button
              size="sm"
              className="gap-1"
              onClick={openGenerateModal}
            >
              <IconPlus className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
          <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
              Unused
            </p>
            <p className="mt-1 text-metric font-bold text-land-ink">
              {stats.unused}
            </p>
          </div>
          <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
              Redeemed
            </p>
            <p className="mt-1 text-metric font-bold text-land-ink">
              {stats.redeemed}
            </p>
          </div>
          <div className="rounded-xl bg-land-pink p-3 md:rounded-2xl md:p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
              Sales
            </p>
            <p className="mt-1 text-metric font-bold text-land-ink">
              {currency} {stats.sales.toFixed(0)}
            </p>
          </div>
          <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
              Batches
            </p>
            <p className="mt-1 text-metric font-bold text-land-ink">
              {stats.batches}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "unused", label: "Unused" },
                { id: "redeemed", label: "Redeemed" },
                { id: "void", label: "Void" },
                { id: "expired", label: "Expired" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`rounded-full px-3 py-1.5 text-2xs font-medium ${
                  filter === opt.id
                    ? "bg-accent text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-2xs text-muted">{filtered.length} codes</p>
        </div>

        <Input
          label="Search"
          placeholder="Code, package, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {selectedCount > 0 ? (
          <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas/95 px-3 py-2 shadow-sm backdrop-blur md:rounded-2xl">
            <p className="text-2xs font-medium text-secondary md:text-xs-tight">
              {selectedCount} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="xs"
                variant="secondary"
                disabled={busy}
                onClick={() => printSelection([...selected])}
              >
                Print sheet
              </Button>
              <Button
                size="xs"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setAssignVendorId(vendors[0]?.id ?? "");
                  setAssignOpen(true);
                }}
              >
                Assign to vendor
              </Button>
              <Button
                size="xs"
                variant="secondary"
                disabled={busy}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-danger"
                disabled={busy}
                onClick={() => void deleteIds([...selected])}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-inset/70" />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
            <IconPackages className="h-5 w-5 text-muted" />
            <p className="mt-3 text-xs-tight font-semibold">No vouchers yet</p>
            <p className="mt-1 max-w-sm text-2xs text-muted">
              Generate a batch linked to a prepaid package for offline sales.
            </p>
            <Button size="sm" className="mt-4" onClick={openGenerateModal}>
              Generate vouchers
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-canvas md:rounded-2xl">
            <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 md:px-4">
              <label className="flex cursor-pointer items-center gap-2 text-2xs text-secondary">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                />
                Select all ({filtered.length})
              </label>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((v) => {
                const isOn = selected.has(v.id);
                return (
                  <li
                    key={v.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-3 py-3 md:px-4 ${
                      isOn ? "bg-inset/60" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                        checked={isOn}
                        onChange={() => toggleOne(v.id)}
                        aria-label={`Select ${v.code}`}
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-xs-tight font-bold tracking-wide md:text-title">
                          {v.code}
                        </p>
                        <p className="mt-0.5 text-2xs text-muted">
                          {v.packageName} · {v.batchLabel}
                          {v.hotspotName
                            ? ` · ${v.hotspotName}`
                            : " · All locations"}
                          {v.vendorName ? ` · Vendor: ${v.vendorName}` : ""}
                          {v.redeemedByEmail ? ` · ${v.redeemedByEmail}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pl-7 sm:pl-0">
                      <span className="rounded-full bg-inset px-2 py-0.5 text-[9px] font-semibold capitalize text-secondary">
                        {v.status}
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => printSelection([v.id])}
                      >
                        Print
                      </Button>
                      {v.status === "unused" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => void voidCode(v.id)}
                        >
                          Void
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-danger"
                        disabled={busy}
                        onClick={() => void deleteIds([v.id])}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Modal
          open={modalOpen}
          onClose={() => !saving && setModalOpen(false)}
          title="Generate vouchers"
          description="Codes can be printed or exported for shop counters."
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="voucher-form"
                size="sm"
                disabled={saving}
              >
                {saving ? "Generating…" : "Generate"}
              </Button>
            </>
          }
        >
          <form id="voucher-form" onSubmit={onGenerate} className="space-y-3">
            <Input
              label="Batch label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium">Location</span>
              <select
                className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
                value={batchHotspotId}
                onChange={(e) => setBatchHotspotId(e.target.value)}
              >
                <option value={LOCATION_ALL}>All locations</option>
                {(hotspots.length ? hotspots : locationHotspots).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <span className="text-2xs text-muted">
                Locked vouchers only redeem at that site; All works everywhere you
                own.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium">Package</span>
              <select
                className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                required
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.currency} {p.price}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium">Give to vendor (optional)</span>
              <select
                className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
                value={batchVendorId}
                onChange={(e) => setBatchVendorId(e.target.value)}
              >
                <option value="">None — sell directly</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <span className="text-2xs text-muted">
                Tracks these codes under the vendor for sales and collections.
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Quantity"
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <Input
                label="Expires (optional)"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </form>
        </Modal>

        <Modal
          open={assignOpen}
          onClose={() => !busy && setAssignOpen(false)}
          title="Assign to vendor"
          description={`${selectedCount} selected · only unused codes are moved.`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="assign-form" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id="assign-form" onSubmit={assignSelected} className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium">Vendor</span>
              <select
                className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs-tight"
                value={assignVendorId}
                onChange={(e) => setAssignVendorId(e.target.value)}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
                <option value="">Take back (no vendor)</option>
              </select>
            </label>
            {vendors.length === 0 ? (
              <p className="text-2xs text-muted">
                No vendors yet.{" "}
                <Link href="/vendors" className="underline">
                  Add one on the Vendors page
                </Link>
                .
              </p>
            ) : null}
          </form>
        </Modal>

        <p className="text-2xs text-muted">
          Customers redeem on the portal. Preview a hotspot QR from{" "}
          <Link href="/hotspots" className="underline">
            Hotspots
          </Link>
          .
        </p>
      </div>

      <VoucherPrintSheet vouchers={printList} packages={packages} />
    </>
  );
}
