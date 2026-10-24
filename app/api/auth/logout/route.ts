import { jsonError, jsonOk } from "@/lib/api";
import * as authService from "@/lib/services/auth";

export async function POST() {
  try {
    await authService.logout();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
