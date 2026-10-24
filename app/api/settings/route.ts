import { jsonError, jsonOk } from "@/lib/api";
import {
  getSettings,
  updateFreeMode,
  updateProfile,
} from "@/lib/services/settings";

export async function GET() {
  try {
    const settings = await getSettings();
    return jsonOk({ settings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (
      body &&
      typeof body === "object" &&
      "freeModeEnabled" in body
    ) {
      const profile = await updateFreeMode(body);
      return jsonOk({ profile, freeMode: true });
    }
    const profile = await updateProfile(body);
    return jsonOk({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
