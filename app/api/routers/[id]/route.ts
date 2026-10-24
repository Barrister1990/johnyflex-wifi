import { jsonError, jsonOk } from "@/lib/api";
import * as routerService from "@/lib/services/routers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const router = await routerService.updateRouter(id, body);
    return jsonOk({ router });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await routerService.deleteRouter(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
