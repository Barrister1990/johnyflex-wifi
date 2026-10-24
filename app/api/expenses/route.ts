import { jsonError, jsonOk } from "@/lib/api";
import { createExpense, removeExpense } from "@/lib/services/revenue";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const expense = await createExpense(body);
    return jsonOk({ expense }, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonError(new Error("id required"), 400);
    await removeExpense(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
