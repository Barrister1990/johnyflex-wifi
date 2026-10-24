import { jsonError, jsonOk } from "@/lib/api";
import { listOwnerDevices } from "@/lib/services/devices";

export async function GET(request: Request) {
  try {
    const hotspotId = new URL(request.url).searchParams.get("hotspotId");
    const devices = await listOwnerDevices(hotspotId);
    return jsonOk({ devices });
  } catch (error) {
    return jsonError(error);
  }
}
