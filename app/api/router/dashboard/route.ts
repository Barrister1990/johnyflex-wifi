import { jsonError, jsonOk } from "@/lib/api";
import { getOwnerRouterDashboard } from "@/lib/services/router-dashboard";

export async function GET() {
  try {
    const dashboard = await getOwnerRouterDashboard();
    return jsonOk(dashboard);
  } catch (error) {
    return jsonError(error);
  }
}
