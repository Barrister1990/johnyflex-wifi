import { jsonError, jsonOk } from "@/lib/api";
import { claimFreeAccess } from "@/lib/services/free-mode";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await claimFreeAccess(body);
    return jsonOk({
      reference: result.payment.reference,
      freeUntil: result.freeUntil,
      unlockOk: result.unlockOk,
      unlockError: result.unlockError,
      session: result.session,
    });
  } catch (error) {
    return jsonError(error);
  }
}
