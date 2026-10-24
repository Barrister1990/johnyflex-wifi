import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { Customer } from "@/lib/types";

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  hotspot_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    hotspotId: row.hotspot_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findOrCreateCustomer(input: {
  email: string;
  hotspotId: string;
  name?: string | null;
}): Promise<Customer> {
  const email = input.email.toLowerCase();
  const supabase = createServiceSupabaseClient();

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing) {
    const row = existing as CustomerRow;
    if (row.hotspot_id !== input.hotspotId) {
      const { data, error } = await supabase
        .from("customers")
        .update({
          hotspot_id: input.hotspotId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapCustomer(data as CustomerRow);
    }
    return mapCustomer(row);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      email,
      name: input.name ?? null,
      hotspot_id: input.hotspotId,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCustomer(data as CustomerRow);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCustomer(data as CustomerRow) : null;
}

export async function findCustomerByEmail(
  email: string,
): Promise<Customer | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .ilike("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCustomer(data as CustomerRow) : null;
}

/** PostgREST `.in()` is sent in the URL; too many UUIDs → HTTP 400 Bad Request. */
const IN_CHUNK = 100;

function chunkIds(ids: string[]): string[][] {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    chunks.push(unique.slice(i, i + IN_CHUNK));
  }
  return chunks;
}

export async function listCustomersByIds(ids: string[]): Promise<Customer[]> {
  const chunks = chunkIds(ids);
  if (chunks.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const rows: Customer[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data as CustomerRow[]) ?? []).map(mapCustomer));
  }
  return rows;
}

export async function listCustomersByHotspotIds(
  hotspotIds: string[],
): Promise<Customer[]> {
  const chunks = chunkIds(hotspotIds);
  if (chunks.length === 0) return [];
  const supabase = createServiceSupabaseClient();
  const rows: Customer[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .in("hotspot_id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data as CustomerRow[]) ?? []).map(mapCustomer));
  }
  return rows;
}
