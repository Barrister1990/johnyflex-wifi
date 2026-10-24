import { createNotification } from "@/lib/repositories/notifications";
import { getCustomerById, findCustomerByEmail } from "@/lib/repositories/customers";
import { getDeviceById } from "@/lib/repositories/devices";
import { getHotspotById } from "@/lib/repositories/hotspots";
import { getPaymentById } from "@/lib/repositories/payments";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { mikrotikSweepExpiredIpBindings } from "@/lib/router/mikrotik-rest";
import { resolveMikroTikConfigForHotspot } from "@/lib/router/resolve-config";
import {
  hotspotHasLiveMikroTik,
  revokeSessionAccess,
} from "@/lib/router/session-access";
import type { DeviceSession } from "@/lib/types";

type SessionRow = {
  id: string;
  hotspot_id: string;
  package_id: string;
  customer_id: string;
  device_id: string;
  payment_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};

function mapSession(row: SessionRow): DeviceSession {
  return {
    id: row.id,
    hotspotId: row.hotspot_id,
    packageId: row.package_id,
    customerId: row.customer_id,
    deviceId: row.device_id,
    paymentId: row.payment_id,
    status: row.status as DeviceSession["status"],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    bytesDown: 0,
    bytesUp: 0,
    routerBytesIn: 0,
    routerBytesOut: 0,
    bytesSampledAt: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveSessionMac(session: DeviceSession): Promise<string | null> {
  const payment = await getPaymentById(session.paymentId);
  const paymentMac = normalizeMac(payment?.clientMac);
  if (isUsableClientMac(paymentMac)) return paymentMac;

  const device = await getDeviceById(session.deviceId);
  const deviceMac = normalizeMac(device?.macAddress);
  if (isUsableClientMac(deviceMac)) return deviceMac;

  return null;
}

async function revokeOneSession(session: DeviceSession): Promise<void> {
  const mac = await resolveSessionMac(session);
  await revokeSessionAccess({
    hotspotId: session.hotspotId,
    sessionId: session.id,
    macAddress: mac,
  });
}

async function resolveSweepHotspotIds(
  hotspotIds?: string[],
): Promise<string[]> {
  if (hotspotIds && hotspotIds.length > 0) {
    return [...new Set(hotspotIds)];
  }
  // Full cron run: sweep every site that has a linked router.
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("hotspots")
    .select("id")
    .not("router_id", "is", null);
  if (error) {
    console.warn("[wifihub] sweep hotspot list", error.message);
    return [];
  }
  return ((data as Array<{ id: string }>) ?? []).map((h) => h.id);
}

async function sweepHotspotBindings(hotspotIds?: string[]): Promise<number> {
  const unique = await resolveSweepHotspotIds(hotspotIds);
  let swept = 0;
  for (const hotspotId of unique) {
    if (!(await hotspotHasLiveMikroTik(hotspotId))) continue;
    const { config } = await resolveMikroTikConfigForHotspot(hotspotId);
    if (!config) continue;
    try {
      swept += await mikrotikSweepExpiredIpBindings(config);
    } catch (err) {
      console.warn(
        "[wifihub] binding sweep",
        hotspotId,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return swept;
}

/**
 * Mark due sessions expired, notify the owner, and revoke MikroTik access.
 * No auto-renew — access ends when the package timer ends.
 */
export async function processExpiredSessions(
  hotspotIds?: string[],
): Promise<{ expired: number; revoked: number; swept: number; errors: string[] }> {
  const supabase = createServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("device_sessions")
    .select("*")
    .eq("status", "active")
    .lt("ends_at", nowIso);

  if (hotspotIds && hotspotIds.length > 0) {
    query = query.in("hotspot_id", hotspotIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const due = ((data as SessionRow[]) ?? []).map(mapSession);
  if (due.length === 0) {
    const swept = await sweepHotspotBindings(hotspotIds);
    return { expired: 0, revoked: 0, swept, errors: [] };
  }

  const updatedAt = new Date().toISOString();
  const ids = due.map((s) => s.id);
  await supabase
    .from("device_sessions")
    .update({ status: "expired", updated_at: updatedAt })
    .in("id", ids);

  let revoked = 0;
  const errors: string[] = [];

  for (const session of due) {
    const hotspot = await getHotspotById(session.hotspotId);
    if (hotspot) {
      const customer = await getCustomerById(session.customerId);
      const email = customer?.email ?? "a customer";
      await createNotification({
        ownerId: hotspot.ownerId,
        type: "session_expired",
        title: "Session expired",
        body: `Session for ${email} ended — Wi‑Fi access was cut off.`,
        href: "/sessions",
      });
    }

    try {
      await revokeOneSession(session);
      revoked += 1;
    } catch (err) {
      errors.push(
        err instanceof Error
          ? `${session.id}: ${err.message}`
          : `${session.id}: revoke failed`,
      );
    }
  }

  const swept = await sweepHotspotBindings(due.map((s) => s.hotspotId));

  return { expired: due.length, revoked, swept, errors };
}

/**
 * End all active Free Mode sessions for an operator (e.g. Free Mode turned off).
 */
export async function expireActiveFreeModeSessions(
  ownerId: string,
  hotspotId?: string | null,
): Promise<{ expired: number; revoked: number }> {
  const supabase = createServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  let hotspotIds: string[];
  if (hotspotId) {
    hotspotIds = [hotspotId];
  } else {
    const { data: hotspots, error: hErr } = await supabase
      .from("hotspots")
      .select("id")
      .eq("owner_id", ownerId);
    if (hErr) throw new Error(hErr.message);
    hotspotIds = ((hotspots as Array<{ id: string }>) ?? []).map((h) => h.id);
  }
  if (hotspotIds.length === 0) return { expired: 0, revoked: 0 };

  const { data: payments, error: pErr } = await supabase
    .from("payments")
    .select("id")
    .eq("provider", "free")
    .in("hotspot_id", hotspotIds);
  if (pErr) throw new Error(pErr.message);
  const paymentIds = ((payments as Array<{ id: string }>) ?? []).map((p) => p.id);
  if (paymentIds.length === 0) return { expired: 0, revoked: 0 };

  const { data: sessions, error: sErr } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("status", "active")
    .in("payment_id", paymentIds);
  if (sErr) throw new Error(sErr.message);

  const active = ((sessions as SessionRow[]) ?? []).map(mapSession);
  if (active.length === 0) return { expired: 0, revoked: 0 };

  await supabase
    .from("device_sessions")
    .update({ status: "expired", ends_at: nowIso, updated_at: nowIso })
    .in(
      "id",
      active.map((s) => s.id),
    );

  let revoked = 0;
  for (const session of active) {
    try {
      await revokeOneSession(session);
      revoked += 1;
    } catch (err) {
      console.warn(
        "[wifihub] free mode revoke",
        session.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await sweepHotspotBindings(hotspotIds);
  return { expired: active.length, revoked };
}

/**
 * Mark monthly subscriptions past period end as expired (no auto-renew).
 * Also expires any still-active device sessions at that hotspot for the email.
 */
export async function processExpiredSubscriptions(
  ownerId?: string,
): Promise<{ expired: number }> {
  const supabase = createServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lt("current_period_end", nowIso);

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return { expired: 0 };

  const updatedAt = new Date().toISOString();
  const ids = rows.map((r: { id: string }) => r.id);
  await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: updatedAt })
    .in("id", ids);

  // Cut related active sessions for those customers at the plan hotspot
  for (const row of rows as Array<{
    customer_email: string;
    hotspot_id: string;
    owner_id: string;
  }>) {
    const customer = await findCustomerByEmail(row.customer_email);
    if (!customer) continue;

    const sessions = await supabase
      .from("device_sessions")
      .select("id")
      .eq("hotspot_id", row.hotspot_id)
      .eq("customer_id", customer.id)
      .eq("status", "active");

    const sessionIds = ((sessions.data as Array<{ id: string }>) ?? []).map(
      (s) => s.id,
    );
    if (sessionIds.length === 0) continue;

    await supabase
      .from("device_sessions")
      .update({ ends_at: nowIso, updated_at: updatedAt })
      .in("id", sessionIds);
  }

  await processExpiredSessions();
  return { expired: rows.length };
}
