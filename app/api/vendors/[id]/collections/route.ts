import { jsonError, jsonOk } from "@/lib/api";
import { recordVendorCollection } from "@/lib/services/vendors";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const collection = await recordVendorCollection(id, body);
    return jsonOk({ collection }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
