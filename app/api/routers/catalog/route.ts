import { jsonError, jsonOk } from "@/lib/api";
import * as routerService from "@/lib/services/routers";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const items = await routerService.searchCatalog(q);
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error);
  }
}
