import * as notificationRepo from "@/lib/repositories/notifications";
import { findUserById } from "@/lib/repositories/users";
import { requireUser } from "@/lib/services/auth";
import type { Notification, NotificationType } from "@/lib/types";

export async function notifyOwner(input: {
  ownerId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
}): Promise<Notification | null> {
  const owner = await findUserById(input.ownerId);
  if (owner) {
    if (input.type === "payment_success" && !owner.notifyPaymentSuccess) {
      return null;
    }
    if (input.type === "session_expired" && !owner.notifySessionExpired) {
      return null;
    }
    if (input.type === "system" && !owner.notifySystem) {
      return null;
    }
  }
  return notificationRepo.createNotification(input);
}

export async function listMyNotifications(): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> {
  const user = await requireUser();
  const notifications = await notificationRepo.listNotificationsByOwner(
    user.id,
  );
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount };
}

export async function markMyNotificationRead(
  id: string,
): Promise<Notification> {
  const user = await requireUser();
  const updated = await notificationRepo.markNotificationRead(id, user.id);
  if (!updated) throw new Error("Notification not found");
  return updated;
}

export async function markAllMyNotificationsRead(): Promise<{ count: number }> {
  const user = await requireUser();
  const count = await notificationRepo.markAllNotificationsRead(user.id);
  return { count };
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();
  return notificationRepo.countUnread(user.id);
}
