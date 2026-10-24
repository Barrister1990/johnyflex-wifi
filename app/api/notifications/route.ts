import { jsonError, jsonOk } from "@/lib/api";
import {
  listMyNotifications,
  markAllMyNotificationsRead,
} from "@/lib/services/notifications";

export async function GET() {
  try {
    const data = await listMyNotifications();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    const result = await markAllMyNotificationsRead();
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
