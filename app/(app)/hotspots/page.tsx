"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconHotspots, IconPlus, IconQr } from "@/components/icons";
import type { HotspotStatus, HotspotWithRouter } from "@/lib/types";

type FormState = {
  name: string;
  ssid: string;
  address: string;
  status: HotspotStatus;
};

const emptyForm: FormState = {
  name: "",
  ssid: "",
  address: "",
  status: "active",
};

function statusTone(status: HotspotStatus) {
  if (status === "active") return "bg-success/10 text-success";
  if (status === "maintenance") return "bg-land-yellow text-land-ink";
  return "bg-inset text-secondary";
}

function mikrotikStatus(hs: HotspotWithRouter): {
  label: string;
  tone: string;
  detail: string;
} {
  const router = hs.router;
  if (!router || router.adapterType !== "mikrotik") {
    return {
      label: "MikroTik not linked",
      tone: "bg-inset text-muted",
      detail: "Run the setup wizard to attach this site’s router.",
    };
  }
  if (router.connectionStatus === "connected") {
    const checked = router.lastCheckedAt
      ? ` · checked ${new Date(router.lastCheckedAt).toLocaleString()}`
      : "";
    return {
      label: "MikroTik linked",
      tone: "bg-success/10 text-success",
      detail: router.host
        ? `${router.label} · ${router.host}${checked}`
        : `${router.label}${checked}`,
    };
  }
  if (router.connectionStatus === "error") {
    return {
      label: "Offline",
      tone: "bg-danger/10 text-danger",
      detail: "Test again or re-check tunnel / API password.",
    };
  }
  if (router.connectionStatus === "pending") {
    return {
      label: "Pending",
      tone: "bg-land-blue text-land-ink",
      detail: "Saved — click Test link to verify.",
    };
  }
  return {
    label: "Not configured",
    tone: "bg-inset text-muted",
    detail: "Add host and password in the MikroTik wizard.",
  };
}

function printQrSign(qr: {
  dataUrl: string;
  name: string;
  ssid: string;
}) {
  const printWindow = window.open("", "_blank", "width=700,height=900");
  if (!printWindow) return;

  const document = printWindow.document;
  document.title = `${qr.name} Wi-Fi sign`;

  const style = document.createElement("style");
  style.textContent =
    "body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#111;background:#fff}" +
    ".sign{max-width:520px;margin:auto;border:3px solid #111;border-radius:24px;padding:36px;text-align:center}" +
    "h1{font-size:30px;margin:0 0 8px}h2{font-size:20px;margin:0 0 24px;color:#444}" +
    "img{width:280px;height:280px}.steps{text-align:left;margin:24px auto 0;max-width:390px;font-size:18px;line-height:1.65}" +
    ".ssid{font-weight:700}.note{font-size:14px;color:#555;margin-top:20px}@media print{body{padding:0}.sign{border:none}}";
  document.head.appendChild(style);

  const sign = document.createElement("main");
  sign.className = "sign";
  const title = document.createElement("h1");
  title.textContent = qr.name;
  const subtitle = document.createElement("h2");
  subtitle.textContent = "Connect. Scan. Pay. You're online.";
  const image = document.createElement("img");
  image.src = qr.dataUrl;
  image.alt = "Wi-Fi portal QR code";
  const steps = document.createElement("ol");
  steps.className = "steps";
  for (const text of [
    `Connect to Wi-Fi: ${qr.ssid}`,
    "Scan this QR code",
    "Choose a package and pay",
    "Internet access starts automatically",
  ]) {
    const item = document.createElement("li");
    item.textContent = text;
    if (text.includes(qr.ssid)) item.className = "ssid";
    steps.appendChild(item);
  }
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "Please connect to the Wi-Fi before scanning.";
  sign.append(title, subtitle, image, steps, note);
  document.body.appendChild(sign);
  printWindow.setTimeout(() => printWindow.print(), 250);
}

export default function HotspotsPage() {
  const toast = useToast();
  const [hotspots, setHotspots] = useState<HotspotWithRouter[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HotspotWithRouter | null>(
    null,
  );
  const [qr, setQr] = useState<{
    id: string;
    dataUrl: string;
    url: string;
    name: string;
    ssid: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | HotspotStatus>("all");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/hotspots");
    const data = await res.json();
    if (res.ok) setHotspots(data.hotspots);
    else toast.error("Could not load hotspots", data.error);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return hotspots;
    return hotspots.filter((h) => h.status === filter);
  }, [hotspots, filter]);

  const stats = useMemo(() => {
    const mikrotikLinked = hotspots.filter(
      (h) => h.router?.adapterType === "mikrotik",
    );
    return {
      total: hotspots.length,
      active: hotspots.filter((h) => h.status === "active").length,
      connected: mikrotikLinked.filter(
        (h) => h.router?.connectionStatus === "connected",
      ).length,
      mikrotik: mikrotikLinked.length,
    };
  }, [hotspots]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(hs: HotspotWithRouter) {
    setEditingId(hs.id);
    setForm({
      name: hs.name,
      ssid: hs.ssid,
      address: hs.address,
      status: hs.status,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      ssid: form.ssid.trim(),
      address: form.address.trim(),
      status: form.status,
    };

    const res = await fetch(
      editingId ? `/api/hotspots/${editingId}` : "/api/hotspots",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save hotspot");
      toast.error("Save failed", data.error);
      return;
    }

    toast.success(
      editingId ? "Hotspot updated" : "Hotspot created",
      editingId
        ? "Site details saved."
        : "Next: attach MikroTik with the setup wizard.",
    );
    closeModal();
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/hotspots/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      toast.error("Delete failed", data.error);
      return;
    }
    toast.success("Hotspot deleted", `${deleteTarget.name} was removed.`);
    setDeleteTarget(null);
    if (qr?.id === deleteTarget.id) setQr(null);
    await load();
  }

  async function showQr(hs: HotspotWithRouter) {
    const res = await fetch(`/api/hotspots/${hs.id}/qr`);
    const data = await res.json();
    if (!res.ok) {
      toast.error("QR failed", data.error);
      return;
    }
    setQr({
      id: hs.id,
      dataUrl: data.dataUrl,
      url: data.url,
      name: hs.name,
      ssid: hs.ssid,
    });
  }

  async function testLink(routerId: string) {
    setTestingId(routerId);
    const res = await fetch(`/api/routers/${routerId}/test`, { method: "POST" });
    const data = await res.json();
    setTestingId(null);
    if (!res.ok) {
      toast.error("Connection test failed", data.error);
      await load();
      return;
    }
    const status = data.router?.connectionStatus as string | undefined;
    const message = data.router?.message as string | undefined;
    if (status === "connected") {
      toast.success("MikroTik connected", message ?? data.router.label);
    } else if (status === "error") {
      toast.error("MikroTik offline", message ?? "Could not reach REST API");
    } else {
      toast.info(
        "Check recorded",
        message ?? `${data.router.label}: ${status ?? "unknown"}`,
      );
    }
    await load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted md:text-xs-tight">
            Sites
          </p>
          <h1 className="mt-0.5 text-h2 font-semibold tracking-tight">
            Hotspots
          </h1>
          <p className="mt-0.5 text-2xs text-secondary md:text-xs-tight">
            Create a site, attach MikroTik with the wizard, then print the
            portal QR.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/router/setup">
            <Button size="sm" variant="secondary">
              MikroTik wizard
            </Button>
          </Link>
          <Button size="sm" onClick={openCreate} className="gap-1">
            <IconPlus className="h-3.5 w-3.5" />
            New hotspot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <div className="rounded-xl bg-land-yellow p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Sites
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl bg-land-blue p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            Active
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.active}
          </p>
        </div>
        <div className="rounded-xl bg-land-lavender p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-land-ink/55">
            MikroTik linked
          </p>
          <p className="mt-1 text-metric font-bold text-land-ink">
            {stats.mikrotik}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-canvas p-3 md:rounded-2xl md:p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
            Connected now
          </p>
          <p className="mt-1 text-metric font-bold text-success">
            {stats.connected}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-full border border-border bg-canvas p-0.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
              { id: "maintenance", label: "Maintenance" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-colors md:text-xs-tight ${
                filter === opt.id
                  ? "bg-accent text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-2xs text-muted">
          {filtered.length} hotspot{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl bg-inset/70 md:rounded-2xl"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-canvas px-4 py-12 text-center md:rounded-2xl md:py-16">
          <div className="rounded-xl bg-inset p-3 text-secondary">
            <IconHotspots className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs-tight font-semibold md:text-title">
            {hotspots.length === 0 ? "No hotspots yet" : "No matches"}
          </p>
          <p className="mt-1 max-w-sm text-2xs text-muted md:text-xs-tight">
            Add a site name, SSID, and address — then connect MikroTik with the
            wizard.
          </p>
          {hotspots.length === 0 ? (
            <Button size="sm" className="mt-4" onClick={openCreate}>
              Create hotspot
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:gap-3">
          {filtered.map((hs) => {
            const link = mikrotikStatus(hs);
            return (
              <article
                key={hs.id}
                className="flex flex-col rounded-xl border border-border bg-canvas p-3 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs-tight font-semibold md:text-title">
                      {hs.name}
                    </h2>
                    <p className="mt-0.5 font-mono text-2xs text-muted">
                      {hs.ssid}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize md:text-2xs ${statusTone(hs.status)}`}
                  >
                    {hs.status}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-2xs text-secondary">
                  {hs.address}
                </p>

                <div className="mt-3 rounded-xl border border-border bg-surface px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${link.tone}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          link.label === "Online"
                            ? "bg-success"
                            : link.label === "Offline"
                              ? "bg-danger"
                              : "bg-muted"
                        }`}
                      />
                      {link.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-2xs text-muted">{link.detail}</p>
                  {!hs.router || hs.router.adapterType !== "mikrotik" ? (
                    <Link
                      href="/router/setup"
                      className="mt-2 inline-block text-2xs font-medium text-accent underline"
                    >
                      Open MikroTik wizard
                    </Link>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    className="gap-1"
                    onClick={() => void showQr(hs)}
                  >
                    <IconQr className="h-3.5 w-3.5" />
                    QR
                  </Button>
                  {hs.router?.adapterType === "mikrotik" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={testingId === hs.router.id}
                      onClick={() => void testLink(hs.router!.id)}
                    >
                      {testingId === hs.router.id ? "Testing…" : "Test link"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => openEdit(hs)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-danger"
                    onClick={() => setDeleteTarget(hs)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit hotspot" : "New hotspot"}
        description="Name the site and Wi‑Fi SSID. Attach MikroTik next with the wizard."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="hotspot-form"
              size="sm"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Create hotspot"}
            </Button>
          </>
        }
      >
        <form id="hotspot-form" onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Site name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Accra Café"
            required
          />
          <Input
            label="SSID"
            value={form.ssid}
            onChange={(e) => setForm({ ...form, ssid: e.target.value })}
            placeholder="JohnnyFlex-Cafe"
            required
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Oxford Street, Osu, Accra"
            required
          />
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium text-primary md:text-xs-tight">
              Status
            </span>
            <select
              className="rounded-xl border border-border bg-canvas px-2.5 py-2 text-xs-tight outline-none focus:border-primary md:rounded-[10px] md:px-3.5 md:py-2.5 md:text-sm"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as HotspotStatus,
                })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
          {!editingId ? (
            <p className="rounded-xl bg-surface px-3 py-2 text-2xs text-muted">
              After creating, open{" "}
              <Link href="/router/setup" className="font-medium underline">
                MikroTik wizard
              </Link>{" "}
              to connect the router and confirm it shows as connected.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-2xs text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={!!qr}
        onClose={() => setQr(null)}
        title="Portal QR code"
        description={qr?.name}
        size="sm"
        footer={
          <>
            {qr ? (
              <>
                <Button type="button" size="sm" onClick={() => printQrSign(qr)}>
                  Print customer sign
                </Button>
                <a
                  href={qr.dataUrl}
                  download={`wifihub-qr-${qr.id}.png`}
                  className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-xs-tight font-medium text-white md:text-sm"
                >
                  Download QR only
                </a>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setQr(null)}
            >
              Close
            </Button>
          </>
        }
      >
        {qr ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.dataUrl}
              alt="Hotspot QR"
              className="h-48 w-48 rounded-xl border border-border bg-white p-2"
            />
            <div className="rounded-xl border border-border bg-inset p-3 text-left text-xs leading-relaxed text-secondary">
              <p className="font-semibold text-primary">Customer instructions</p>
              <ol className="mt-1 list-inside list-decimal">
                <li>
                  Connect to <span className="font-semibold">{qr.ssid}</span>
                </li>
                <li>Scan the QR code</li>
                <li>Choose a package and pay</li>
                <li>Internet access starts automatically</li>
              </ol>
            </div>
            <p className="break-all text-center text-2xs text-muted">{qr.url}</p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={confirmDelete}
        title="Delete hotspot?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” and its portal QR will stop working. Linked equipment stays in your inventory unassigned.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        tone="danger"
        loading={deleting}
      />
    </div>
  );
}
