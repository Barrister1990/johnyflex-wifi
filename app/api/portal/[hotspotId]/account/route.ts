import { jsonError, jsonOk } from "@/lib/api";
import { getCustomerPortalAccount } from "@/lib/services/customer-portal";

type Ctx = { params: Promise<{ hotspotId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { hotspotId } = await ctx.params;
    const email = new URL(request.url).searchParams.get("email");
    if (!email) throw new Error("Email required");
    const account = await getCustomerPortalAccount(hotspotId, email);
    return jsonOk({ account });
  } catch (error) {
    return jsonError(error);
  }
}
