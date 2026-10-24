import { jsonError, jsonOk } from "@/lib/api";
import {
  createSubscriptionPlan,
  listOwnerSubscriptionPlans,
  listOwnerSubscriptions,
} from "@/lib/services/subscriptions";

export async function GET() {
  try {
    const [plans, subscriptions] = await Promise.all([
      listOwnerSubscriptionPlans(),
      listOwnerSubscriptions(),
    ]);
    return jsonOk({ plans, subscriptions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = await createSubscriptionPlan(body);
    return jsonOk({ plan }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
