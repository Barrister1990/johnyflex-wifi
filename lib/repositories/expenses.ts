import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { Expense } from "@/lib/types";

type ExpenseRow = {
  id: string;
  owner_id: string;
  category: string;
  description: string;
  amount: number | string;
  currency: string;
  incurred_at: string;
  notes: string | null;
  hotspot_id?: string | null;
  created_at: string;
  updated_at: string;
};

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    ownerId: row.owner_id,
    category: row.category,
    description: row.description,
    amount: typeof row.amount === "string" ? Number(row.amount) : row.amount,
    currency: row.currency,
    incurredAt: row.incurred_at,
    notes: row.notes,
    hotspotId: row.hotspot_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listExpensesByOwner(
  ownerId: string,
  opts?: { from?: string; to?: string; hotspotId?: string | null },
): Promise<Expense[]> {
  const supabase = createServiceSupabaseClient();
  let q = supabase
    .from("expenses")
    .select("*")
    .eq("owner_id", ownerId)
    .order("incurred_at", { ascending: false });
  if (opts?.from) q = q.gte("incurred_at", opts.from.slice(0, 10));
  if (opts?.to) q = q.lte("incurred_at", opts.to.slice(0, 10));
  if (opts?.hotspotId) q = q.eq("hotspot_id", opts.hotspotId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data as ExpenseRow[]) ?? []).map(mapExpense);
}

export async function createExpense(input: {
  ownerId: string;
  category: string;
  description: string;
  amount: number;
  currency?: string;
  incurredAt: string;
  notes?: string | null;
  hotspotId?: string | null;
}): Promise<Expense> {
  const now = new Date().toISOString();
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      owner_id: input.ownerId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? "GHS",
      incurred_at: input.incurredAt.slice(0, 10),
      notes: input.notes ?? null,
      hotspot_id: input.hotspotId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapExpense(data as ExpenseRow);
}

export async function deleteExpense(
  id: string,
  ownerId: string,
): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}
