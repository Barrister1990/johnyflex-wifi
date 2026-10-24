import { jsonError, jsonOk } from "@/lib/api";
import * as authService from "@/lib/services/auth";

export async function GET() {
  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      return jsonError(new Error("Unauthorized"), 401);
    }
    return jsonOk({ user });
  } catch (error) {
    return jsonError(error);
  }
}
