import { jsonError, jsonOk } from "@/lib/api";
import { deleteVendorCollection } from "@/lib/services/vendors";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteVendorCollection(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
