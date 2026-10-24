import { jsonError, jsonOk } from "@/lib/api";
import { listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { requireUser } from "@/lib/services/auth";
import { syncActiveSessionUsage } from "@/lib/services/session-usage";

/** Sample MikroTik traffic for this operator's live sessions. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const hotspotId = url.searchParams.get("hotspotId");
    const hotspots = await listHotspotsByOwner(user.id);
    const ids =
      hotspotId && hotspots.some((h) => h.id === hotspotId)
        ? [hotspotId]
        : hotspots.map((h) => h.id);
    const result = await syncActiveSessionUsage(ids);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
