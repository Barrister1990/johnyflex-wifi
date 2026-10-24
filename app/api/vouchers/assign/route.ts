import { jsonError, jsonOk } from "@/lib/api";
import { assignOwnerVouchers } from "@/lib/services/vendors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await assignOwnerVouchers(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
