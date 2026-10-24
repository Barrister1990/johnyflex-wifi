/**
 * Minimal MikroTik RouterOS REST client (RouterOS v7+ /rest).
 * Uses HTTP Basic auth. Falls back callers should catch errors.
 */

export type MikroTikConfig = {
  host: string;
  user: string;
  password: string;
  port: number;
  secure: boolean;
};

export type MikroTikResource = {
  "cpu-load"?: string;
  "free-memory"?: string;
  "total-memory"?: string;
  uptime?: string;
  version?: string;
  "board-name"?: string;
};

export type MikroTikInterfaceStats = {
  name?: string;
  "rx-byte"?: string;
  "tx-byte"?: string;
};

function baseUrl(cfg: MikroTikConfig) {
  const scheme = cfg.secure ? "https" : "http";
  return `${scheme}://${cfg.host}:${cfg.port}`;
}

function authHeader(cfg: MikroTikConfig) {
  const token = Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64");
  return `Basic ${token}`;
}

export function getMikroTikConfigFromEnv(): MikroTikConfig | null {
  const host = process.env.MIKROTIK_HOST?.trim();
  const user = process.env.MIKROTIK_USER?.trim();
  if (!host || !user) return null;
  return {
    host,
    user,
    password: process.env.MIKROTIK_PASSWORD ?? "",
    port: Number(process.env.MIKROTIK_PORT || (process.env.MIKROTIK_SECURE === "1" ? 443 : 80)),
    secure:
      process.env.MIKROTIK_SECURE === "1" ||
      process.env.MIKROTIK_PORT === "443",
  };
}

async function restFetch<T>(
  cfg: MikroTikConfig,
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const url = `${baseUrl(cfg)}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = init?.timeoutMs ?? 8_000;
  const { timeoutMs: _t, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(cfg),
        "Content-Type": "application/json",
        ...(fetchInit.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `MikroTik REST ${res.status}: ${text.slice(0, 160) || res.statusText}`,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name)
        : "";
    const msg = error instanceof Error ? error.message : String(error);
    if (
      name === "AbortError" ||
      msg.includes("This operation was aborted") ||
      msg.includes("aborted")
    ) {
      const viaVpn = cfg.host.startsWith("10.8.");
      throw new Error(
        viaVpn
          ? `Timed out reaching ${cfg.host}:${cfg.port} over WireGuard (${timeoutMs / 1000}s). On the VPS run: sudo wg show && ping -c2 ${cfg.host}. On MikroTik: WireGuard handshake + allow input from 10.8.0.1 to www/rest, and www service enabled.`
          : `Timed out reaching ${cfg.host}:${cfg.port} (${timeoutMs / 1000}s). Check host/port, that RouterOS www/REST is on, and the app can route to the router.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function mikrotikGetResource(
  cfg: MikroTikConfig,
  opts?: { timeoutMs?: number },
): Promise<MikroTikResource> {
  const data = await restFetch<MikroTikResource | MikroTikResource[]>(
    cfg,
    "/rest/system/resource",
    { timeoutMs: opts?.timeoutMs },
  );
  return Array.isArray(data) ? (data[0] ?? {}) : data;
}

export type MikroTikHotspotActive = {
  "mac-address"?: string;
  user?: string;
  address?: string;
  /** Bytes received from the client (upload). */
  "bytes-in"?: string;
  /** Bytes sent to the client (download). */
  "bytes-out"?: string;
  uptime?: string;
};

export async function mikrotikGetHotspotActive(
  cfg: MikroTikConfig,
  opts?: { timeoutMs?: number },
): Promise<MikroTikHotspotActive[]> {
  try {
    const data = await restFetch<MikroTikHotspotActive[]>(
      cfg,
      "/rest/ip/hotspot/active",
      { timeoutMs: opts?.timeoutMs },
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Ensure a bypassed (or other) IP binding for this MAC.
 * Prefer PUT first (fast path); list+PATCH only when MAC already exists.
 */
export async function mikrotikAddIpBinding(
  cfg: MikroTikConfig,
  input: { macAddress: string; comment: string; type?: string },
  opts?: { timeoutMs?: number },
): Promise<void> {
  const mac = input.macAddress.toLowerCase();
  const timeoutMs = opts?.timeoutMs ?? 4_000;
  const body = {
    "mac-address": input.macAddress,
    type: input.type ?? "bypassed",
    comment: input.comment.slice(0, 60),
    disabled: "false",
  };

  try {
    await restFetch(cfg, "/rest/ip/hotspot/ip-binding", {
      method: "PUT",
      body: JSON.stringify(body),
      timeoutMs,
    });
    return;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(msg)) throw error;
  }

  const list = await restFetch<
    Array<{ ".id"?: string; "mac-address"?: string }>
  >(cfg, "/rest/ip/hotspot/ip-binding", { timeoutMs });
  const rows = Array.isArray(list) ? list : [];
  const existing = rows.find(
    (r) => (r["mac-address"] ?? "").toLowerCase() === mac,
  );
  if (!existing?.[".id"]) {
    throw new Error("IP binding exists but could not be located for PATCH");
  }
  await restFetch(cfg, `/rest/ip/hotspot/ip-binding/${existing[".id"]}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    timeoutMs,
  });
}

export async function mikrotikRemoveIpBindingByMac(
  cfg: MikroTikConfig,
  macAddress: string,
): Promise<void> {
  const list = await restFetch<Array<{ ".id"?: string; "mac-address"?: string }>>(
    cfg,
    "/rest/ip/hotspot/ip-binding",
  );
  const rows = Array.isArray(list) ? list : [];
  const match = rows.find(
    (r) =>
      (r["mac-address"] ?? "").toLowerCase() === macAddress.toLowerCase(),
  );
  if (match?.[".id"]) {
    await restFetch(cfg, `/rest/ip/hotspot/ip-binding/${match[".id"]}`, {
      method: "DELETE",
    });
  }
}

/** Remove bypass binding created for a WiFiHub session (comment wh:{session8}:…). */
export async function mikrotikRemoveIpBindingBySessionId(
  cfg: MikroTikConfig,
  sessionId: string,
): Promise<void> {
  const prefix = `wh:${sessionId.slice(0, 8)}:`;
  const list = await restFetch<
    Array<{ ".id"?: string; comment?: string }>
  >(cfg, "/rest/ip/hotspot/ip-binding");
  const rows = Array.isArray(list) ? list : [];
  for (const row of rows) {
    const comment = row.comment ?? "";
    if (comment.startsWith(prefix) && row[".id"]) {
      await restFetch(cfg, `/rest/ip/hotspot/ip-binding/${row[".id"]}`, {
        method: "DELETE",
      });
    }
  }
}

/**
 * Safety net: delete bypass bindings whose embedded end timestamp has passed.
 * Returns count removed.
 */
export async function mikrotikSweepExpiredIpBindings(
  cfg: MikroTikConfig,
): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  const list = await restFetch<
    Array<{ ".id"?: string; comment?: string }>
  >(cfg, "/rest/ip/hotspot/ip-binding");
  const rows = Array.isArray(list) ? list : [];
  let removed = 0;
  for (const row of rows) {
    const comment = row.comment ?? "";
    const m = comment.match(/^wh:[a-f0-9]{8}:(\d+)$/i);
    if (!m || !row[".id"]) continue;
    const endSec = Number(m[1]);
    if (!Number.isFinite(endSec) || endSec >= nowSec) continue;
    try {
      await restFetch(cfg, `/rest/ip/hotspot/ip-binding/${row[".id"]}`, {
        method: "DELETE",
      });
      removed += 1;
    } catch {
      /* try next */
    }
  }
  return removed;
}

export async function mikrotikProbe(
  cfg: MikroTikConfig,
  opts?: { timeoutMs?: number },
): Promise<{
  ok: boolean;
  message: string;
  resource?: MikroTikResource;
}> {
  try {
    const resource = await mikrotikGetResource(cfg, opts);
    return {
      ok: true,
      message: `Connected to ${resource["board-name"] ?? cfg.host} (RouterOS ${resource.version ?? "?"})`,
      resource,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not reach MikroTik REST API",
    };
  }
}

export function parseCpuPercent(resource: MikroTikResource): number {
  const raw = resource["cpu-load"];
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

export function parseMemoryPercent(resource: MikroTikResource): number {
  const free = Number(resource["free-memory"] ?? NaN);
  const total = Number(resource["total-memory"] ?? NaN);
  if (!Number.isFinite(free) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(((total - free) / total) * 100));
}

/** Parse "10Mbps" / "20M" / "512k" into RouterOS rate string (e.g. 10M). */
export function parseSpeedToRate(speedProfile: string): string | null {
  const raw = speedProfile.trim().toLowerCase().replace(/\s+/g, "");
  const m = raw.match(/^(\d+(?:\.\d+)?)(mbps|mbit|mb|m|kbps|kbit|kb|k)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] ?? "m").toLowerCase();
  if (unit.startsWith("k")) return `${Math.round(n)}k`;
  return `${Math.round(n)}M`;
}

/** Look up current client IP for a MAC (hotspot host, then DHCP lease). */
export async function mikrotikResolveIpForMac(
  cfg: MikroTikConfig,
  macAddress: string,
): Promise<string | null> {
  const mac = macAddress.toLowerCase();
  try {
    const hosts = await restFetch<
      Array<{ "mac-address"?: string; address?: string }>
    >(cfg, "/rest/ip/hotspot/host");
    const rows = Array.isArray(hosts) ? hosts : [];
    const hit = rows.find(
      (r) => (r["mac-address"] ?? "").toLowerCase() === mac && r.address,
    );
    if (hit?.address) return hit.address.split("/")[0] ?? hit.address;
  } catch {
    /* try DHCP next */
  }
  try {
    const leases = await restFetch<
      Array<{ "mac-address"?: string; address?: string; status?: string }>
    >(cfg, "/rest/ip/dhcp-server/lease");
    const rows = Array.isArray(leases) ? leases : [];
    const hit = rows.find(
      (r) => (r["mac-address"] ?? "").toLowerCase() === mac && r.address,
    );
    if (hit?.address) return hit.address.split("/")[0] ?? hit.address;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Upsert a simple queue limiting download/upload for a client.
 * Prefers IP/32 target (reliable); falls back to MAC. Logs on failure.
 */
export async function mikrotikApplySimpleQueue(
  cfg: MikroTikConfig,
  input: { macAddress: string; speedProfile: string; name: string },
  opts?: { timeoutMs?: number },
): Promise<void> {
  const rate = parseSpeedToRate(input.speedProfile);
  if (!rate) {
    console.warn(
      "[wifihub] speed profile not parseable:",
      input.speedProfile,
    );
    return;
  }

  const timeoutMs = opts?.timeoutMs ?? 5_000;
  const maxLimit = `${rate}/${rate}`;
  const name = input.name.slice(0, 48);
  const ip = await mikrotikResolveIpForMac(cfg, input.macAddress);
  // IP target is what actually shapes Fast.com / real traffic for bypassed hosts.
  const target = ip ? `${ip}/32` : input.macAddress;

  try {
    const list = await restFetch<
      Array<{ ".id"?: string; name?: string; target?: string }>
    >(cfg, "/rest/queue/simple", { timeoutMs });
    const rows = Array.isArray(list) ? list : [];
    const existing = rows.find(
      (r) =>
        (r.name ?? "") === name ||
        (r.target ?? "").toLowerCase().includes(input.macAddress.toLowerCase()) ||
        (ip != null && (r.target ?? "").includes(ip)),
    );

    const body = {
      name,
      target,
      "max-limit": maxLimit,
      comment: `wifihub ${input.speedProfile}`.slice(0, 60),
    };

    if (existing?.[".id"]) {
      await restFetch(cfg, `/rest/queue/simple/${existing[".id"]}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        timeoutMs,
      });
    } else {
      await restFetch(cfg, "/rest/queue/simple", {
        method: "PUT",
        body: JSON.stringify(body),
        timeoutMs,
      });
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "queue apply failed";
    console.warn(
      `[wifihub] bandwidth queue failed for ${target} (${input.speedProfile}): ${detail}`,
    );
  }
}

export async function mikrotikRemoveSimpleQueueByName(
  cfg: MikroTikConfig,
  name: string,
): Promise<void> {
  try {
    const list = await restFetch<Array<{ ".id"?: string; name?: string }>>(
      cfg,
      "/rest/queue/simple",
    );
    const rows = Array.isArray(list) ? list : [];
    const match = rows.find((r) => (r.name ?? "") === name.slice(0, 48));
    if (match?.[".id"]) {
      await restFetch(cfg, `/rest/queue/simple/${match[".id"]}`, {
        method: "DELETE",
      });
    }
  } catch {
    /* ignore */
  }
}

/** RouterOS limit-uptime string from remaining milliseconds (e.g. 2h30m). */
export function formatLimitUptime(ms: number): string {
  const totalSec = Math.max(60, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${Math.max(1, mins)}m`);
  return parts.join("");
}

function hotspotUserName(sessionId: string) {
  return `wh${sessionId.replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Timed hotspot user bound to MAC (limit-uptime = package remaining time).
 * Works with MAC login / cookies; pairs with bypassed IP binding for instant access.
 */
export async function mikrotikUpsertTimedHotspotUser(
  cfg: MikroTikConfig,
  input: {
    sessionId: string;
    macAddress: string;
    endsAt: string;
    comment?: string;
    speedProfile?: string;
  },
  opts?: { timeoutMs?: number },
): Promise<void> {
  const remaining = new Date(input.endsAt).getTime() - Date.now();
  if (remaining < 5_000) {
    throw new Error("Package time has already ended");
  }
  const timeoutMs = opts?.timeoutMs ?? 5_000;
  const name = hotspotUserName(input.sessionId);
  const limitUptime = formatLimitUptime(remaining);
  const rate = input.speedProfile
    ? parseSpeedToRate(input.speedProfile)
    : null;
  const body: Record<string, string> = {
    name,
    password: name,
    "mac-address": input.macAddress,
    "limit-uptime": limitUptime,
    comment: (
      input.comment ?? `wifihub ends ${input.endsAt}`
    ).slice(0, 60),
    disabled: "false",
  };
  if (rate) {
    // Hotspot user rate-limit (rx/tx). Helps when not fully bypassed.
    body["rate-limit"] = `${rate}/${rate}`;
  }

  try {
    const list = await restFetch<
      Array<{ ".id"?: string; name?: string; "mac-address"?: string }>
    >(cfg, "/rest/ip/hotspot/user", { timeoutMs });
    const rows = Array.isArray(list) ? list : [];
    const existing = rows.find(
      (r) =>
        (r.name ?? "") === name ||
        (r["mac-address"] ?? "").toLowerCase() ===
          input.macAddress.toLowerCase(),
    );
    if (existing?.[".id"]) {
      await restFetch(cfg, `/rest/ip/hotspot/user/${existing[".id"]}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        timeoutMs,
      });
    } else {
      await restFetch(cfg, "/rest/ip/hotspot/user", {
        method: "PUT",
        body: JSON.stringify(body),
        timeoutMs,
      });
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "hotspot user failed";
    throw new Error(`Could not set package timer on MikroTik: ${detail}`);
  }
}

export async function mikrotikRemoveHotspotUserForSession(
  cfg: MikroTikConfig,
  sessionId: string,
): Promise<void> {
  const name = hotspotUserName(sessionId);
  try {
    const list = await restFetch<Array<{ ".id"?: string; name?: string }>>(
      cfg,
      "/rest/ip/hotspot/user",
    );
    const rows = Array.isArray(list) ? list : [];
    const match = rows.find((r) => (r.name ?? "") === name);
    if (match?.[".id"]) {
      await restFetch(cfg, `/rest/ip/hotspot/user/${match[".id"]}`, {
        method: "DELETE",
      });
    }
  } catch {
    /* ignore */
  }
}

/** Disconnect active hotspot host by MAC (forces re-auth after revoke). */
export async function mikrotikRemoveActiveByMac(
  cfg: MikroTikConfig,
  macAddress: string,
): Promise<void> {
  try {
    const list = await restFetch<
      Array<{ ".id"?: string; "mac-address"?: string }>
    >(cfg, "/rest/ip/hotspot/active");
    const rows = Array.isArray(list) ? list : [];
    for (const row of rows) {
      if (
        (row["mac-address"] ?? "").toLowerCase() === macAddress.toLowerCase() &&
        row[".id"]
      ) {
        await restFetch(cfg, `/rest/ip/hotspot/active/${row[".id"]}`, {
          method: "DELETE",
        });
      }
    }
  } catch {
    /* ignore */
  }
}
