"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconHotspots, IconPackages, IconPlus } from "@/components/icons";
import type {
  Hotspot,
  Package,
  SubscriptionListItem,
  SubscriptionPlan,
} from "@/lib/types";

const MAX_DURATION_MINUTES = 43_200; // 30 days

type CatalogTab = "prepaid" | "monthly" | "subscribers";

type PrepaidForm = {
  name: string;
  price: string;
  durationMinutes: string;
  dataLimitMb: string;
  speedProfile: string;
  enabled: boolean;
  allHotspots: boolean;
  hotspotIds: string[];
};

type MonthlyForm = {
  name: string;
  price: string;
  speedProfile: string;
  description: string;
  intervalDays: string;
  dataUnlimited: boolean;
  dataLimitMb: string;
  hotspotId: string;
  enabled: boolean;
};

const emptyPrepaid: PrepaidForm = {
  name: "",
  price: "",
  durationMinutes: "60",
  dataLimitMb: "",
  speedProfile: "10Mbps",
  enabled: true,
  allHotspots: true,
  hotspotIds: [],
};

const emptyMonthly: MonthlyForm = {
  name: "Month Pass",
  price: "80",
  speedProfile: "20Mbps",
  description: "Unlimited monthly access",
  intervalDays: "30",
  dataUnlimited: true,
  dataLimitMb: "",
  hotspotId: "",
  enabled: true,
};

const MONTHLY_NAME_PRESETS = [
  { label: "Basic Month", name: "Basic Month", description: "Everyday browsing · 30 days" },
  { label: "Premium Month", name: "Premium Month", description: "Faster speeds · 30 days" },
  { label: "Student Month", name: "Student Month", description: "Study-friendly monthly plan" },
  { label: "Family Month", name: "Family Month", description: "Shared monthly access" },
];

const DURATION_PRESETS = [
  { label: "1 hr", minutes: 60 },
  { label: "3 hr", minutes: 180 },
  { label: "1 day", minutes: 1_440 },
  { label: "7 days", minutes: 10_080 },
  { label: "14 days", minutes: 20_160 },
  { label: "1 month", minutes: 43_200 },
];

/** Suggested package names for common café / hotspot passes. */
const NAME_PRESETS = [
  { label: "Day Pass", name: "Day Pass", minutes: 1_440 },
  { label: "Week Pass", name: "Week Pass", minutes: 10_080 },
  { label: "Month Pass", name: "Month Pass", minutes: 43_200 },
  { label: "Full Day", name: "Full Day", minutes: 1_440 },
  { label: "Weekend", name: "Weekend Pass", minutes: 2_880 },
  { label: "Student Week", name: "Student Week", minutes: 10_080 },
];

const SPEED_PRESETS = ["5Mbps", "10Mbps", "20Mbps", "50Mbps"];

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
  }
  if (minutes >= 43_200) return "1 month";
  const d = minutes / 1440;
  return Number.isInteger(d)
    ? `${d} day${d === 1 ? "" : "s"}`
    : `${d.toFixed(1)} days`;
}

export default function PackagesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<CatalogTab>("prepaid");
  const [packages, setPackages] = useState<Package[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>(
    [],
  );
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);

  const [prepaidForm, setPrepaidForm] = useState<PrepaidForm>(emptyPrepaid);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [prepaidModal, setPrepaidModal] = useState(false);
  const [deletePackage, setDeletePackage] = useState<Package | null>(null);
  const [packageError, setPackageError] = useState("");
  const [savingPackage, setSavingPackage] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState(false);
  const [packageFilter, setPackageFilter] = useState<
    "all" | "enabled" | "disabled"
  >("all");

  const [monthlyForm, setMonthlyForm] = useState<MonthlyForm>(emptyMonthly);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [monthlyModal, setMonthlyModal] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  async function load() {
    setLoading(true);
    const [pRes, sRes, hRes] = await Promise.all([
      fetch("/api/packages"),
      fetch("/api/subscriptions"),
      fetch("/api/hotspots"),
    ]);
    const pData = await pRes.json();
    const sData = await sRes.json();
    const hData = await hRes.json();
    if (pRes.ok) setPackages(pData.packages);
    else toast.error("Could not load packages", pData.error);
    if (sRes.ok) {
      setPlans(sData.plans);
      setSubscriptions(sData.subscriptions);
    } else toast.error("Could not load monthly plans", sData.error);
    if (hRes.ok) setHotspots(hData.hotspots);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPackages = useMemo(() => {
    if (packageFilter === "enabled") return packages.filter((p) => p.enabled);
    if (packageFilter === "disabled") return packages.filter((p) => !p.enabled);
    return packages;
  }, [packages, packageFilter]);

  const stats = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.status === "active");
    return {
      prepaid: packages.length,
      monthly: plans.length,
      activeSubs: activeSubs.length,
      mrr: activeSubs.reduce((sum, s) => sum + s.price, 0),
    };
  }, [packages, plans, subscriptions]);

  function openCreatePrepaid() {
    setEditingPackageId(null);
    setPrepaidForm(emptyPrepaid);
    setPackageError("");
    setPrepaidModal(true);
  }

  function openEditPrepaid(pkg: Package) {
    setEditingPackageId(pkg.id);
    setPrepaidForm({
      name: pkg.name,
      price: String(pkg.price),
      durationMinutes: String(pkg.durationMinutes),
      dataLimitMb: pkg.dataLimitMb != null ? String(pkg.dataLimitMb) : "",
      speedProfile: pkg.speedProfile,
      enabled: pkg.enabled,
      allHotspots: !pkg.hotspotIds || pkg.hotspotIds.length === 0,
      hotspotIds: pkg.hotspotIds ?? [],
    });
    setPackageError("");
    setPrepaidModal(true);
  }

  async function savePrepaid(e: FormEvent) {
    e.preventDefault();
    setSavingPackage(true);
    setPackageError("");

    const durationMinutes = Number(prepaidForm.durationMinutes);
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > MAX_DURATION_MINUTES
    ) {
      setPackageError("Duration must be between 1 minute and 1 month (30 days).");
      setSavingPackage(false);
      return;
    }

    const payload = {
      name: prepaidForm.name.trim(),
      price: Number(prepaidForm.price),
      durationMinutes,
      dataLimitMb: prepaidForm.dataLimitMb
        ? Number(prepaidForm.dataLimitMb)
        : null,
      speedProfile: prepaidForm.speedProfile.trim(),
      currency: "GHS",
      enabled: prepaidForm.enabled,
      hotspotIds: prepaidForm.allHotspots ? null : prepaidForm.hotspotIds,
    };

    if (!payload.name || Number.isNaN(payload.price) || payload.price < 0) {
      setPackageError("Enter a valid name and price");
      setSavingPackage(false);
      return;
    }

    const res = await fetch(
      editingPackageId
        ? `/api/packages/${editingPackageId}`
        : "/api/packages",
      {
        method: editingPackageId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    setSavingPackage(false);

    if (!res.ok) {
      setPackageError(data.error ?? "Failed to save package");
      toast.error("Save failed", data.error);
      return;
    }

    toast.success(
      editingPackageId ? "Package updated" : "Package created",
      `${payload.name} is ready for your portal.`,
    );
    setPrepaidModal(false);
    setEditingPackageId(null);
    setPrepaidForm(emptyPrepaid);
    await load();
  }

  async function togglePackage(pkg: Package) {
    const res = await fetch(`/api/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !pkg.enabled }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not update status", data.error);
      return;
    }
    toast.success(
      pkg.enabled ? "Package disabled" : "Package enabled",
      `${pkg.name} is now ${pkg.enabled ? "hidden from" : "available on"} the portal.`,
    );
    await load();
  }

  async function confirmDeletePackage() {
    if (!deletePackage) return;
    setDeletingPackage(true);
    const res = await fetch(`/api/packages/${deletePackage.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeletingPackage(false);
    if (!res.ok) {
      toast.error("Delete failed", data.error ?? "Try again");
      return;
    }
    toast.success("Package deleted", `${deletePackage.name} was removed.`);
    setDeletePackage(null);
    await load();
  }

  function openCreateMonthly() {
    setEditingPlanId(null);
    setMonthlyForm(emptyMonthly);
    setMonthlyModal(true);
  }

  function openEditMonthly(plan: SubscriptionPlan) {
    setEditingPlanId(plan.id);
    setMonthlyForm({
      name: plan.name,
      price: String(plan.price),
      speedProfile: plan.speedProfile,
      description: plan.description,
      intervalDays: String(plan.intervalDays),
      dataUnlimited: plan.dataLimitMb == null,
      dataLimitMb: plan.dataLimitMb != null ? String(plan.dataLimitMb) : "",
      hotspotId: plan.hotspotId ?? "",
      enabled: plan.enabled,
    });
    setMonthlyModal(true);
  }

  async function saveMonthly(e: FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    const body = {
      name: monthlyForm.name,
      price: Number(monthlyForm.price),
      currency: "GHS",
      speedProfile: monthlyForm.speedProfile,
      dataLimitMb: monthlyForm.dataUnlimited
        ? null
        : Number(monthlyForm.dataLimitMb),
      intervalDays: Number(monthlyForm.intervalDays),
      hotspotId: monthlyForm.hotspotId || null,
      enabled: monthlyForm.enabled,
      description: monthlyForm.description,
    };
    const res = await fetch(
      editingPlanId
        ? `/api/subscriptions/${editingPlanId}`
        : "/api/subscriptions",
      {
        method: editingPlanId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json();
    setSavingPlan(false);
    if (!res.ok) toast.error("Could not save plan", data.error);
    else {
      toast.success(editingPlanId ? "Plan updated" : "Plan created");
      setMonthlyModal(false);
      await load();
    }
  }

  async function confirmDeletePlan() {
    if (!deletePlanId) return;
    const res = await fetch(`/api/subscriptions/${deletePlanId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not delete", data.error);
    else {
      toast.success("Plan deleted");
      setDeletePlanId(null);
      await load();
    }
  }

  async function cancelSub(id: string) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    if (!res.ok) toast.error("Could not cancel", data.error);
    else {
      toast.success("Subscription cancelled");
      await load();
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Catalog
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Packages
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Prepaid passes (up to 1 month) and monthly plans — one place for
            portal pricing.
          </p>
        </div>
        {tab === "prepaid" ? (
          <Button size="sm" onClick={openCreatePrepaid} className="gap-1">
            <IconPlus className="h-3.5 w-3.5" />
            New prepaid
          </Button>
        ) : tab === "monthly" ? (
          <Button size="sm" onClick={openCreateMonthly} className="gap-1">
            <IconPlus className="h-3.5 w-3.5" />
            New monthly
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Prepaid
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.prepaid}
          </p>
        </div>
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Monthly
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.monthly}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Subscribers
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.activeSubs}
          </p>
        </div>
        <div className="rounded-xl bg-land-pink p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            MRR
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            GHS {stats.mrr.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-border bg-canvas p-0.5">
        {(
          [
            { id: "prepaid", label: "Prepaid" },
            { id: "monthly", label: "Monthly" },
            { id: "subscribers", label: "Subscribers" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTab(opt.id)}
            className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
              tab === opt.id
                ? "bg-accent text-white"
                : "text-secondary hover:text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-inset/70 md:rounded-2xl"
            />
          ))}
        </div>
      ) : null}

      {!loading && tab === "prepaid" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full border border-border bg-canvas p-0.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "enabled", label: "Enabled" },
                  { id: "disabled", label: "Disabled" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPackageFilter(opt.id)}
                  className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
                    packageFilter === opt.id
                      ? "bg-inset text-primary"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-2xs text-muted">
              {filteredPackages.length} package
              {filteredPackages.length === 1 ? "" : "s"} · max 1 month
            </p>
          </div>

          {filteredPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center md:rounded-2xl md:py-16">
              <div className="rounded-xl bg-inset p-3 text-secondary">
                <IconPackages className="h-5 w-5" />
              </div>
              <p className="mt-3 text-xs-tight font-semibold md:text-title">
                {packages.length === 0
                  ? "No prepaid packages yet"
                  : "No packages in this filter"}
              </p>
              <p className="mt-1 max-w-xs text-2xs text-muted md:text-xs-tight">
                Create a pass from 1 hour up to 1 month for portal checkout.
              </p>
              {packages.length === 0 ? (
                <Button size="sm" className="mt-4" onClick={openCreatePrepaid}>
                  Create prepaid
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:gap-3">
              {filteredPackages.map((pkg) => (
                <article
                  key={pkg.id}
                  className="flex flex-col rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inset text-primary">
                        <IconHotspots className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-xs-tight font-semibold md:text-title">
                          {pkg.name}
                        </h2>
                        <p className="mt-0.5 text-2xs text-muted">
                          {pkg.speedProfile}
                          {pkg.dataLimitMb != null
                            ? ` · ${pkg.dataLimitMb} MB`
                            : " · Unlimited data"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void togglePackage(pkg)}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold md:text-2xs ${
                        pkg.enabled
                          ? "bg-success/10 text-success"
                          : "bg-inset text-secondary"
                      }`}
                    >
                      {pkg.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-2xs text-muted">Price</p>
                      <p className="text-title font-bold tracking-tight md:text-h2">
                        {pkg.currency} {pkg.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xs text-muted">Duration</p>
                      <p className="text-xs-tight font-semibold">
                        {formatDuration(pkg.durationMinutes)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-1.5 border-t border-border pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="flex-1"
                      onClick={() => openEditPrepaid(pkg)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-danger"
                      onClick={() => setDeletePackage(pkg)}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {!loading && tab === "monthly" ? (
        plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center md:rounded-2xl md:py-16">
            <div className="rounded-xl bg-inset p-3 text-secondary">
              <IconHotspots className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs-tight font-semibold md:text-title">
              No monthly plans yet
            </p>
            <p className="mt-1 max-w-xs text-2xs text-muted md:text-xs-tight">
              Add Basic / Premium monthly access for the portal.
            </p>
            <Button size="sm" className="mt-4" onClick={openCreateMonthly}>
              Create monthly
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:gap-3">
            {plans.map((p) => (
              <article
                key={p.id}
                className="flex flex-col rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inset text-primary">
                      <IconHotspots className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs-tight font-semibold md:text-title">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-2xs text-muted">
                        {p.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                      p.enabled
                        ? "bg-success/10 text-success"
                        : "bg-inset text-secondary"
                    }`}
                  >
                    {p.enabled ? "Live" : "Off"}
                  </span>
                </div>
                <p className="mt-3 text-title font-bold">
                  {p.currency} {p.price}
                  <span className="text-2xs font-medium text-muted">
                    /{p.intervalDays}d
                  </span>
                </p>
                <p className="mt-1 text-2xs text-muted">
                  {p.speedProfile}
                  {p.dataLimitMb == null
                    ? " · Unlimited"
                    : ` · ${p.dataLimitMb} MB`}
                </p>
                <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
                  <Button
                    size="xs"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => openEditMonthly(p)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeletePlanId(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {!loading && tab === "subscribers" ? (
        subscriptions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-canvas px-4 py-10 text-center text-2xs text-muted md:text-xs-tight">
            Customers appear here after paying for a monthly plan on the portal.
          </p>
        ) : (
          <ul className="space-y-2">
            {subscriptions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas p-3"
              >
                <div>
                  <p className="text-xs-tight font-semibold">
                    {s.customerEmail}
                  </p>
                  <p className="text-2xs text-muted">
                    {s.planName} · {s.hotspotName} · ends{" "}
                    {new Date(s.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-inset px-2 py-0.5 text-[9px] font-semibold capitalize">
                    {s.status}
                  </span>
                  {s.status === "active" ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => void cancelSub(s.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <Modal
        open={prepaidModal}
        onClose={() => {
          if (savingPackage) return;
          setPrepaidModal(false);
          setEditingPackageId(null);
          setPrepaidForm(emptyPrepaid);
          setPackageError("");
        }}
        title={editingPackageId ? "Edit prepaid" : "New prepaid"}
        description="Duration from 1 hour up to 1 month (30 days). Shown on the customer portal."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (savingPackage) return;
                setPrepaidModal(false);
                setEditingPackageId(null);
                setPrepaidForm(emptyPrepaid);
                setPackageError("");
              }}
              disabled={savingPackage}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="prepaid-form"
              size="sm"
              disabled={savingPackage}
            >
              {savingPackage
                ? "Saving…"
                : editingPackageId
                  ? "Save changes"
                  : "Create prepaid"}
            </Button>
          </>
        }
      >
        <form id="prepaid-form" onSubmit={savePrepaid} className="space-y-3">
          <Input
            label="Name"
            value={prepaidForm.name}
            onChange={(e) =>
              setPrepaidForm({ ...prepaidForm, name: e.target.value })
            }
            placeholder="Day Pass"
            required
          />
          <div>
            <p className="mb-1.5 text-2xs font-medium text-primary md:text-xs-tight">
              Quick names
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NAME_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setPrepaidForm({
                      ...prepaidForm,
                      name: p.name,
                      durationMinutes: String(p.minutes),
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-2xs font-medium md:text-xs-tight ${
                    prepaidForm.name === p.name
                      ? "border-accent bg-accent text-white"
                      : "border-border text-secondary hover:border-primary/30"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Price (GHS)"
              type="number"
              min="0"
              step="0.01"
              value={prepaidForm.price}
              onChange={(e) =>
                setPrepaidForm({ ...prepaidForm, price: e.target.value })
              }
              required
            />
            <Input
              label="Duration (minutes)"
              type="number"
              min="1"
              max={MAX_DURATION_MINUTES}
              value={prepaidForm.durationMinutes}
              onChange={(e) =>
                setPrepaidForm({
                  ...prepaidForm,
                  durationMinutes: e.target.value,
                })
              }
              required
            />
          </div>
          <div>
            <p className="mb-1.5 text-2xs font-medium text-primary md:text-xs-tight">
              Quick duration (max 1 month)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  type="button"
                  onClick={() =>
                    setPrepaidForm({
                      ...prepaidForm,
                      durationMinutes: String(p.minutes),
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-2xs font-medium md:text-xs-tight ${
                    Number(prepaidForm.durationMinutes) === p.minutes
                      ? "border-accent bg-accent text-white"
                      : "border-border text-secondary hover:border-primary/30"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Data limit (MB, optional)"
            type="number"
            min="1"
            value={prepaidForm.dataLimitMb}
            onChange={(e) =>
              setPrepaidForm({ ...prepaidForm, dataLimitMb: e.target.value })
            }
            placeholder="Leave empty for unlimited"
          />
          <div>
            <Input
              label="Speed profile"
              value={prepaidForm.speedProfile}
              onChange={(e) =>
                setPrepaidForm({
                  ...prepaidForm,
                  speedProfile: e.target.value,
                })
              }
              required
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SPEED_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setPrepaidForm({ ...prepaidForm, speedProfile: s })
                  }
                  className={`rounded-full border px-2.5 py-1 text-2xs font-medium md:text-xs-tight ${
                    prepaidForm.speedProfile === s
                      ? "border-accent bg-inset text-primary"
                      : "border-border text-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="flex items-center gap-2 text-xs-tight">
              <input
                type="checkbox"
                checked={prepaidForm.allHotspots}
                onChange={(e) =>
                  setPrepaidForm({
                    ...prepaidForm,
                    allHotspots: e.target.checked,
                    hotspotIds: e.target.checked ? [] : prepaidForm.hotspotIds,
                  })
                }
              />
              All locations (every site)
            </label>
            {!prepaidForm.allHotspots ? (
              <div className="space-y-1">
                <p className="text-2xs text-muted">Selected sites only</p>
                {hotspots.map((h) => {
                  const checked = prepaidForm.hotspotIds.includes(h.id);
                  return (
                    <label
                      key={h.id}
                      className="flex items-center gap-2 text-2xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setPrepaidForm({
                            ...prepaidForm,
                            hotspotIds: checked
                              ? prepaidForm.hotspotIds.filter(
                                  (id) => id !== h.id,
                                )
                              : [...prepaidForm.hotspotIds, h.id],
                          });
                        }}
                      />
                      {h.name}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-xs-tight text-secondary">
            <input
              type="checkbox"
              checked={prepaidForm.enabled}
              onChange={(e) =>
                setPrepaidForm({ ...prepaidForm, enabled: e.target.checked })
              }
              className="rounded border-border"
            />
            Enabled for sale on customer portal
          </label>
          {packageError ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-2xs text-danger md:text-xs-tight">
              {packageError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={monthlyModal}
        onClose={() => !savingPlan && setMonthlyModal(false)}
        title={editingPlanId ? "Edit monthly" : "New monthly plan"}
        description="Recurring access sold on the same portal as prepaid packages."
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={savingPlan}
              onClick={() => setMonthlyModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="monthly-form"
              size="sm"
              disabled={savingPlan}
            >
              {savingPlan ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="monthly-form" onSubmit={saveMonthly} className="space-y-3">
          <Input
            label="Name"
            value={monthlyForm.name}
            onChange={(e) =>
              setMonthlyForm({ ...monthlyForm, name: e.target.value })
            }
            required
          />
          <div>
            <p className="mb-1.5 text-2xs font-medium text-primary md:text-xs-tight">
              Quick names
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MONTHLY_NAME_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setMonthlyForm({
                      ...monthlyForm,
                      name: p.name,
                      description: p.description,
                      intervalDays: "30",
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-2xs font-medium md:text-xs-tight ${
                    monthlyForm.name === p.name
                      ? "border-accent bg-accent text-white"
                      : "border-border text-secondary hover:border-primary/30"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Description"
            value={monthlyForm.description}
            onChange={(e) =>
              setMonthlyForm({ ...monthlyForm, description: e.target.value })
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Price (GHS)"
              type="number"
              min={0}
              value={monthlyForm.price}
              onChange={(e) =>
                setMonthlyForm({ ...monthlyForm, price: e.target.value })
              }
              required
            />
            <Input
              label="Interval (days)"
              type="number"
              min={1}
              max={31}
              value={monthlyForm.intervalDays}
              onChange={(e) =>
                setMonthlyForm({
                  ...monthlyForm,
                  intervalDays: e.target.value,
                })
              }
              required
            />
            <Input
              label="Speed"
              value={monthlyForm.speedProfile}
              onChange={(e) =>
                setMonthlyForm({
                  ...monthlyForm,
                  speedProfile: e.target.value,
                })
              }
              required
            />
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium">Location</span>
              <select
                className="rounded-xl border border-border px-3 py-2 text-xs-tight"
                value={monthlyForm.hotspotId}
                onChange={(e) =>
                  setMonthlyForm({
                    ...monthlyForm,
                    hotspotId: e.target.value,
                  })
                }
              >
                <option value="">All hotspots</option>
                {hotspots.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs-tight">
            <input
              type="checkbox"
              checked={monthlyForm.dataUnlimited}
              onChange={(e) =>
                setMonthlyForm({
                  ...monthlyForm,
                  dataUnlimited: e.target.checked,
                })
              }
            />
            Unlimited data
          </label>
          {!monthlyForm.dataUnlimited ? (
            <Input
              label="Data limit (MB)"
              type="number"
              value={monthlyForm.dataLimitMb}
              onChange={(e) =>
                setMonthlyForm({
                  ...monthlyForm,
                  dataLimitMb: e.target.value,
                })
              }
            />
          ) : null}
          <label className="flex items-center gap-2 text-xs-tight">
            <input
              type="checkbox"
              checked={monthlyForm.enabled}
              onChange={(e) =>
                setMonthlyForm({ ...monthlyForm, enabled: e.target.checked })
              }
            />
            Enabled on portal
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletePackage}
        onClose={() => (deletingPackage ? undefined : setDeletePackage(null))}
        onConfirm={confirmDeletePackage}
        title="Delete package?"
        description={
          deletePackage
            ? `“${deletePackage.name}” will be removed from your catalog and portal.`
            : ""
        }
        confirmLabel="Delete package"
        tone="danger"
        loading={deletingPackage}
      />

      <ConfirmDialog
        open={deletePlanId != null}
        onClose={() => setDeletePlanId(null)}
        onConfirm={() => void confirmDeletePlan()}
        title="Delete plan?"
        description="This removes the monthly plan and its linked package."
        confirmLabel="Delete"
      />
    </div>
  );
}
