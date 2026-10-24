import { jsonError, jsonOk } from "@/lib/api";
import {
  deleteOwnerVouchers,
  generateVoucherBatch,
  listOwnerVouchers,
} from "@/lib/services/vouchers";

export async function GET() {
  try {
    const data = await listOwnerVouchers();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateVoucherBatch(body);
    return jsonOk(result, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const result = await deleteOwnerVouchers(ids);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
