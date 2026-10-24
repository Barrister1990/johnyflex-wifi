import { jsonError, jsonOk } from "@/lib/api";
import * as packageService from "@/lib/services/packages";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const pkg = await packageService.updatePackage(id, body);
    return jsonOk({ package: pkg });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await packageService.deletePackage(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
