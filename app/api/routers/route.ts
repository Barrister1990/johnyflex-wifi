import { jsonError, jsonOk } from "@/lib/api";
import * as routerService from "@/lib/services/routers";

export async function GET() {
  try {
    const routers = await routerService.listRouters();
    return jsonOk({ routers });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const router = await routerService.createRouterFromCatalog(body);
    return jsonOk({ router }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
