import { jsonError, jsonOk } from "@/lib/api";
import { getOwnerAnalytics } from "@/lib/services/analytics";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const analytics = await getOwnerAnalytics({
      range: params.get("range"),
      from: params.get("from"),
      to: params.get("to"),
      hotspotId: params.get("hotspotId"),
    });
    return jsonOk({ analytics });
  } catch (error) {
    return jsonError(error);
  }
}
