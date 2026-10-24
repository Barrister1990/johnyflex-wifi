import { jsonError, jsonOk } from "@/lib/api";
import {
  cancelOwnerSubscription,
  deleteSubscriptionPlan,
  updateSubscriptionPlan,
} from "@/lib/services/subscriptions";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const plan = await updateSubscriptionPlan(id, body);
    return jsonOk({ plan });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteSubscriptionPlan(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action === "cancel") {
      const subscription = await cancelOwnerSubscription(id);
      return jsonOk({ subscription });
    }
    throw new Error("Unknown action");
  } catch (error) {
    return jsonError(error);
  }
}
