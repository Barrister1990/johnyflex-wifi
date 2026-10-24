import { jsonError, jsonOk } from "@/lib/api";
import {
  listOwnerSessions,
  revokeOwnerSessions,
} from "@/lib/services/sessions";

export async function GET(request: Request) {
  try {
    const hotspotId = new URL(request.url).searchParams.get("hotspotId");
    const sessions = await listOwnerSessions(hotspotId);
    return jsonOk({ sessions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "revoke") throw new Error("Unknown action");
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const result = await revokeOwnerSessions(ids);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
