import { jsonError, jsonOk } from "@/lib/api";
import { getPaymentMode } from "@/lib/payments";
import { handlePaystackWebhook } from "@/lib/services/payments";

/**
 * Paystack webhook — must stay public (no session auth).
 * Invalid signature → 401. After a charge is recorded we return 200 even if
 * MikroTik unlock is still pending so Paystack does not retry forever.
 */
export async function POST(request: Request) {
  try {
    if (getPaymentMode() !== "paystack") {
      return jsonOk({ ok: true, ignored: true });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    try {
      const result = await handlePaystackWebhook(rawBody, signature);
      return jsonOk(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Webhook processing failed";

      if (message === "Invalid webhook signature") {
        return jsonError(error, 401);
      }

      // Payment not found / verify race — ask Paystack to retry briefly.
      console.error("[paystack webhook]", message);
      return jsonError(error, 500);
    }
  } catch (error) {
    return jsonError(error, 500);
  }
}
