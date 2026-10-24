import { jsonError, jsonOk } from "@/lib/api";
import { ensureAccessForPayment } from "@/lib/services/payments";

/** Public — customer retries Wi‑Fi unlock after a successful Paystack charge. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reference?: string;
      macAddress?: string;
    };
    if (!body.reference?.trim()) {
      return jsonError(new Error("reference required"), 400);
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
