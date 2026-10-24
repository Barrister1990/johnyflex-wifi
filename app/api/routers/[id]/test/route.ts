import { jsonError, jsonOk } from "@/lib/api";
import * as routerService from "@/lib/services/routers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const router = await routerService.testRouterConnection(id);
    return jsonOk({ router });
  } catch (error) {
    return jsonError(error);
  }
}
