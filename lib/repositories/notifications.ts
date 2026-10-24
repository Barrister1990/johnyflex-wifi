import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Notification, NotificationType } from "@/lib/types";

type NotificationRow = {
  id: string;
  owner_id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
  updated_at: string;
};

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    ownerId: row.owner_id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createNotification(input: {
  ownerId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
}): Promise<Notification> {
  // Session expiry / payment success may run without an owner cookie (service path).
  // Prefer service role so portal/webhook flows can notify owners.
  const { createServiceSupabaseClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      owner_id: input.ownerId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      read: false,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapNotification(data as NotificationRow);
}

export async function listNotificationsByOwner(
  ownerId: string,
): Promise<Notification[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as NotificationRow[]) ?? []).map(mapNotification);
}

export async function markNotificationRead(
  id: string,
  ownerId: string,
): Promise<Notification | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapNotification(data as NotificationRow) : null;
}

export async function markAllNotificationsRead(
  ownerId: string,
): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq("owner_id", ownerId)
    .eq("read", false)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function countUnread(ownerId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
