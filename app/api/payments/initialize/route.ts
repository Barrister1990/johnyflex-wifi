import { jsonError, jsonOk } from "@/lib/api";
import { initializePayment } from "@/lib/services/payments";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await initializePayment(body);
    return jsonOk({
      authorizationUrl: result.authorizationUrl,
      reference: result.payment.reference,
    });
  } catch (error) {
    return jsonError(error);
  }
}
