import { jsonError, jsonOk } from "@/lib/api";
import {
  getOwnerPortalThemes,
  saveOwnerPortalTheme,
} from "@/lib/services/portal-themes";

export async function GET() {
  try {
    const data = await getOwnerPortalThemes();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const theme = await saveOwnerPortalTheme(body);
    return jsonOk({ theme });
  } catch (error) {
    return jsonError(error);
  }
}
