import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/services/auth";
import { getRevenueSummary } from "@/lib/services/revenue";
import { buildRevenuePdf } from "@/lib/services/revenue-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const preset = url.searchParams.get("preset") ?? "month";
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");

    const summary = await getRevenueSummary({
      preset,
      from,
      to,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      hotspotId: url.searchParams.get("hotspotId"),
    });

    const pdf = await buildRevenuePdf(summary, {
      companyName: "JohnnyFlex",
      generatedBy: user.email ?? user.id,
    });

    const filename = `wifihub-financial-${summary.from}_${summary.to}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
