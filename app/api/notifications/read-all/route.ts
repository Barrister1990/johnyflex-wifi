import { jsonError, jsonOk } from "@/lib/api";
import { markAllMyNotificationsRead } from "@/lib/services/notifications";

export async function POST() {
  try {
    const result = await markAllMyNotificationsRead();
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
