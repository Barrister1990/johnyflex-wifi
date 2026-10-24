import { jsonError, jsonOk } from "@/lib/api";
import {
  deleteOwnerVendor,
  getOwnerVendorDetail,
  updateOwnerVendor,
} from "@/lib/services/vendors";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const data = await getOwnerVendorDetail(id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const vendor = await updateOwnerVendor(id, body);
    return jsonOk({ vendor });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteOwnerVendor(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
