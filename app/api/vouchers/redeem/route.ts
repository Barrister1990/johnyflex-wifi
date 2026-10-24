import { jsonError, jsonOk } from "@/lib/api";
import { redeemVoucher } from "@/lib/services/vouchers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await redeemVoucher(body);
    return jsonOk({
      reference: result.payment.reference,
      sessionId: result.session.id,
      endsAt: result.session.endsAt,
      packageName: result.package.name,
    });
  } catch (error) {
    return jsonError(error);
  }
}
