import { jsonError, jsonOk } from "@/lib/api";
import { markMyNotificationRead } from "@/lib/services/notifications";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const notification = await markMyNotificationRead(id);
    return jsonOk({ notification });
  } catch (error) {
    return jsonError(error);
  }
}
