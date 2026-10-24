import { jsonError, jsonOk } from "@/lib/api";
import { revokeOwnerSession } from "@/lib/services/sessions";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "revoke") throw new Error("Unknown action");
    const result = await revokeOwnerSession(id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
