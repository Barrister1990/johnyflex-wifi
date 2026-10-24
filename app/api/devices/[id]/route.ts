import { jsonError, jsonOk } from "@/lib/api";
import { revokeOwnerDevice, updateOwnerDevice } from "@/lib/services/devices";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const device = await updateOwnerDevice(id, body);
    return jsonOk({ device });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action === "revoke") {
      const result = await revokeOwnerDevice(id);
      return jsonOk(result);
    }
    throw new Error("Unknown action");
  } catch (error) {
    return jsonError(error);
  }
}
