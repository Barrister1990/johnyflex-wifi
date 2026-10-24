import { jsonError, jsonOk } from "@/lib/api";
import { getHotspotBySlugOrId } from "@/lib/repositories/hotspots";
import { getPaymentByReference } from "@/lib/repositories/payments";
import { ensureAccessForPayment } from "@/lib/services/payments";

type Params = { params: Promise<{ hotspotId: string }> };

/**
 * Portal-scoped Wi‑Fi unlock retry (same as /api/payments/ensure-access).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { hotspotId } = await params;
    const hotspot = await getHotspotBySlugOrId(hotspotId);
    if (!hotspot) {
      return jsonError(new Error("Hotspot not found"), 404);
    }

    const body = (await request.json()) as {
      reference?: string;
      macAddress?: string;
    };
    if (!body.reference?.trim()) {
      return jsonError(new Error("reference required"), 400);
    }

    const payment = await getPaymentByReference(body.reference.trim());
    if (!payment) {
      return jsonError(new Error("Payment not found"), 404);
    }
    if (payment.hotspotId !== hotspot.id) {
      return jsonError(new Error("Payment does not belong to this hotspot"), 403);
    }

    const result = await ensureAccessForPayment(
      body.reference.trim(),
      body.macAddress,
    );
    return jsonOk({
      payment: {
        reference: result.payment.reference,
        status: result.payment.status,
      },
      session: {
        id: result.session.id,
        endsAt: result.session.endsAt,
        status: result.session.status,
      },
      unlockOk: result.unlockOk,
      unlockError: result.unlockError ?? null,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
