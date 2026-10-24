import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getPortalData } from "@/lib/services/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ hotspotId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { hotspotId } = await params;
    const data = await getPortalData(hotspotId);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
