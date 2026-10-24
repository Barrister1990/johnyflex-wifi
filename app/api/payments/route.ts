import { jsonError, jsonOk } from "@/lib/api";
import { listOwnerPayments } from "@/lib/services/payments";
import { requireUser } from "@/lib/services/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const hotspotId = new URL(request.url).searchParams.get("hotspotId");
    const payments = await listOwnerPayments(user.id, hotspotId);
    return jsonOk({ payments });
  } catch (error) {
    return jsonError(error);
  }
}
