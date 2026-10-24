import { jsonError, jsonOk } from "@/lib/api";
import { changePassword } from "@/lib/services/settings";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await changePassword(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
