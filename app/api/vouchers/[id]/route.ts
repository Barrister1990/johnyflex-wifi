import { jsonError, jsonOk } from "@/lib/api";
import {
  deleteOwnerVouchers,
  voidOwnerVoucher,
} from "@/lib/services/vouchers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "void") throw new Error("Unknown action");
    const voucher = await voidOwnerVoucher(id);
    return jsonOk({ voucher });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await deleteOwnerVouchers([id]);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
