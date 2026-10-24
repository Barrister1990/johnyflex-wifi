import { jsonError, jsonOk } from "@/lib/api";
import * as authService from "@/lib/services/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await authService.login(body);
    return jsonOk({ user });
  } catch (error) {
    return jsonError(error);
  }
}
