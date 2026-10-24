import { jsonError, jsonOk } from "@/lib/api";
import { isMoolreConfigured } from "@/lib/payments";
import { handleMoolreWebhook } from "@/lib/services/payments";

/**
 * Moolre payment webhook — must stay public (no session auth).
 * Invalid callback secret → 401. After a charge is recorded we return 200
 * even if MikroTik unlock is still pending so Moolre does not retry forever.
 */
export async function POST(request: Request) {
  try {
    if (!isMoolreConfigured()) {
      return jsonOk({ ok: true, ignored: true });
    }

    const rawBody = await request.text();

    try {
      const result = await handleMoolreWebhook(rawBody);
      return jsonOk(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Webhook processing failed";

      if (message === "Invalid webhook signature") {
        return jsonError(error, 401);
      }

      console.error("[moolre webhook]", message);
      return jsonError(error, 500);
    }
  } catch (error) {
    return jsonError(error, 500);
  }
}
