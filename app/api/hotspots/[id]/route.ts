import { jsonError, jsonOk } from "@/lib/api";
import * as hotspotService from "@/lib/services/hotspots";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const hotspot = await hotspotService.updateHotspot(id, body);
    return jsonOk({ hotspot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await hotspotService.deleteHotspot(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
