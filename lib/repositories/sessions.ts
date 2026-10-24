import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { DeviceSession, SessionStatus } from "@/lib/types";

type SessionRow = {
  id: string;
  hotspot_id: string;
  package_id: string;
  customer_id: string;
  device_id: string;
  payment_id: string;
  status: SessionStatus;
  starts_at: string;
  ends_at: string;
  bytes_down?: number | string | null;
  bytes_up?: number | string | null;
  router_bytes_in?: number | string | null;
  router_bytes_out?: number | string | null;
  bytes_sampled_at?: string | null;
  created_at: string;
  updated_at: string;
};

function toBigIntNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function mapSession(row: SessionRow): DeviceSession {
  return {
    id: row.id,
    hotspotId: row.hotspot_id,
    packageId: row.package_id,
    customerId: row.customer_id,
    deviceId: row.device_id,
    paymentId: row.payment_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    bytesDown: toBigIntNumber(row.bytes_down),
    bytesUp: toBigIntNumber(row.bytes_up),
    routerBytesIn: toBigIntNumber(row.router_bytes_in),
    routerBytesOut: toBigIntNumber(row.router_bytes_out),
    bytesSampledAt: row.bytes_sampled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createSession(input: {
  hotspotId: string;
  packageId: string;
  customerId: string;
  deviceId: string;
  paymentId: string;
  durationMinutes: number;
  /** Override computed end (e.g. Free Mode window end). */
  endsAt?: string;
}): Promise<DeviceSession> {
  const startsAt = new Date();
  const endsAt = input.endsAt
    ? new Date(input.endsAt)
    : new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  const createdAt = startsAt.toISOString();
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from("device_sessions")
    .insert({
      hotspot_id: input.hotspotId,
      package_id: input.packageId,
      customer_id: input.customerId,
      device_id: input.deviceId,
      payment_id: input.paymentId,
      status: "active",
      starts_at: createdAt,
      ends_at: endsAt.toISOString(),
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("*")
    .single();

  // Concurrent callback + webhook: one session per payment wins.
  if (error) {
    const raced = await getSessionByPaymentId(input.paymentId);
    if (raced) return raced;
    throw new Error(error.message);
  }
  return mapSession(data as SessionRow);
}

export async function getSessionByPaymentId(
  paymentId: string,
): Promise<DeviceSession | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSession(data as SessionRow) : null;
}

export async function getSessionById(id: string): Promise<DeviceSession | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSession(data as SessionRow) : null;
}

export async function listSessionsByHotspotIds(
  hotspotIds: string[],
): Promise<DeviceSession[]> {
  if (hotspotIds.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .in("hotspot_id", hotspotIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const now = Date.now();
  return ((data as SessionRow[]) ?? []).map((row) => {
    const session = mapSession(row);
    if (
      session.status === "active" &&
      new Date(session.endsAt).getTime() < now
    ) {
      return { ...session, status: "expired" as SessionStatus };
    }
    return session;
  });
}

export async function listSessionsByCustomerAndHotspot(
  customerId: string,
  hotspotId: string,
): Promise<DeviceSession[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("customer_id", customerId)
    .eq("hotspot_id", hotspotId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as SessionRow[]) ?? []).map(mapSession);
}

export async function listActiveSessionsByDeviceIds(
  deviceIds: string[],
  hotspotIds: string[],
): Promise<DeviceSession[]> {
  if (deviceIds.length === 0 || hotspotIds.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .in("device_id", deviceIds)
    .in("hotspot_id", hotspotIds)
    .eq("status", "active")
    .gt("ends_at", now)
    .order("ends_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as SessionRow[]) ?? []).map(mapSession);
}

export async function listActiveSessionsByCustomerId(
  customerId: string,
  hotspotIds: string[],
): Promise<DeviceSession[]> {
  if (!customerId || hotspotIds.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("customer_id", customerId)
    .in("hotspot_id", hotspotIds)
    .eq("status", "active")
    .gt("ends_at", now)
    .order("ends_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as SessionRow[]) ?? []).map(mapSession);
}

export async function listActiveSessionsByHotspot(
  hotspotId: string,
): Promise<DeviceSession[]> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("hotspot_id", hotspotId)
    .eq("status", "active")
    .gt("ends_at", now);
  if (error) throw new Error(error.message);
  return ((data as SessionRow[]) ?? []).map(mapSession);
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
): Promise<DeviceSession | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("device_sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSession(data as SessionRow) : null;
}

export async function listAllActiveSessions(
  hotspotIds?: string[],
): Promise<DeviceSession[]> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  let q = supabase
    .from("device_sessions")
    .select("*")
    .eq("status", "active")
    .gt("ends_at", now);
  if (hotspotIds && hotspotIds.length > 0) {
    q = q.in("hotspot_id", hotspotIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data as SessionRow[]) ?? []).map(mapSession);
}

export async function updateSessionTraffic(
  id: string,
  input: {
    bytesDown: number;
    bytesUp: number;
    routerBytesIn: number;
    routerBytesOut: number;
  },
): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("device_sessions")
    .update({
      bytes_down: input.bytesDown,
      bytes_up: input.bytesUp,
      router_bytes_in: input.routerBytesIn,
      router_bytes_out: input.routerBytesOut,
      bytes_sampled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
