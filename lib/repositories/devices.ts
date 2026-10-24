import { randomBytes } from "crypto";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { Device } from "@/lib/types";

type DeviceRow = {
  id: string;
  customer_id: string;
  name: string;
  mac_address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    macAddress: row.mac_address,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function syntheticMac(): string {
  const bytes = randomBytes(3);
  const parts = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `02:wh:${parts[0]}:${parts[1]}:${parts[2]}`.toLowerCase();
}

export async function findOrCreateDevice(input: {
  customerId: string;
  macAddress?: string | null;
  name?: string | null;
  phone?: string | null;
}): Promise<Device> {
  const supabase = createServiceSupabaseClient();
  const mac = input.macAddress ?? syntheticMac();

  const { data: existingRows, error: findError } = await supabase
    .from("devices")
    .select("*")
    .eq("customer_id", input.customerId);
  if (findError) throw new Error(findError.message);

  const existing = ((existingRows as DeviceRow[]) ?? []).find(
    (d) => (d.mac_address ?? "").toLowerCase() === mac.toLowerCase(),
  );
  if (existing) return mapDevice(existing);

  const count = (existingRows ?? []).length;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("devices")
    .insert({
      customer_id: input.customerId,
      name: input.name?.trim() || `Device ${count + 1}`,
      mac_address: mac,
      phone: input.phone ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapDevice(data as DeviceRow);
}

export async function findDeviceByMac(
  macAddress: string,
): Promise<Device | null> {
  const devices = await listDevicesByMac(macAddress);
  return devices[0] ?? null;
}

export async function listDevicesByMac(macAddress: string): Promise<Device[]> {
  const mac = macAddress.trim().toLowerCase();
  if (!mac) return [];
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .ilike("mac_address", mac)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return ((data as DeviceRow[]) ?? []).map(mapDevice);
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDevice(data as DeviceRow) : null;
}

export async function updateDevice(
  id: string,
  patch: Partial<Pick<Device, "name" | "phone" | "macAddress">>,
): Promise<Device | null> {
  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.macAddress !== undefined) dbPatch.mac_address = patch.macAddress;

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("devices")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDevice(data as DeviceRow) : null;
}

export async function listDevicesByCustomerIds(
  customerIds: string[],
): Promise<Device[]> {
  if (customerIds.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as DeviceRow[]) ?? []).map(mapDevice);
}

export async function listDevicesByIds(ids: string[]): Promise<Device[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = createServiceSupabaseClient();
  const rows: Device[] = [];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data as DeviceRow[]) ?? []).map(mapDevice));
  }
  return rows;
}
