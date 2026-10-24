import { jsonError, jsonOk } from "@/lib/api";
import * as hotspotService from "@/lib/services/hotspots";

export async function GET() {
  try {
    const hotspots = await hotspotService.listHotspots();
    return jsonOk({ hotspots });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const hotspot = await hotspotService.createHotspot(body);
    return jsonOk({ hotspot }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
