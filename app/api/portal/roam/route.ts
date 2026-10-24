import { jsonError, jsonOk } from "@/lib/api";
import { tryRoamAccess } from "@/lib/services/roaming";

/**
 * Cross-site remaining-time unlock (same owner). Returns { roamed: false }
 * when nothing to grant so the portal can show the normal paywall.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      hotspotId?: string;
      macAddress?: string;
      continueReference?: string;
    };
    if (!body.hotspotId?.trim()) {
      return jsonError(new Error("hotspotId required"), 400);
    }

    const result = await tryRoamAccess({
      hotspotId: body.hotspotId.trim(),
      macAddress: body.macAddress,
      continueReference: body.continueReference,
    });

    if (!result.ok) {
      return jsonOk({ roamed: false, reason: result.reason });
    }

    return jsonOk({
      roamed: true,
      alreadyGranted: result.alreadyGranted,
      reference: result.payment.reference,
      endsAt: result.endsAt,
      sourceHotspotId: result.sourceHotspotId,
      unlockOk: result.unlockOk,
      unlockError: result.unlockError ?? null,
      session: {
        id: result.session.id,
        endsAt: result.session.endsAt,
        status: result.session.status,
      },
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
