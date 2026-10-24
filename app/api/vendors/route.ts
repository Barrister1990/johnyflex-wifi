import { jsonError, jsonOk } from "@/lib/api";
import { createOwnerVendor, listOwnerVendors } from "@/lib/services/vendors";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hotspotId = url.searchParams.get("hotspotId");
    const data = await listOwnerVendors(
      hotspotId && hotspotId !== "all" ? hotspotId : null,
    );
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const vendor = await createOwnerVendor(body);
    return jsonOk({ vendor }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
