import { jsonError, jsonOk } from "@/lib/api";
import { resolvePublicOrigin } from "@/lib/payments";
import * as hotspotService from "@/lib/services/hotspots";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const origin = resolvePublicOrigin(request);
    const qr = await hotspotService.getHotspotQrDataUrl(id, origin);
    return jsonOk(qr);
  } catch (error) {
    return jsonError(error);
  }
}
