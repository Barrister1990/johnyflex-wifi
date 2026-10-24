import { jsonError, jsonOk } from "@/lib/api";
import { getRevenueSummary } from "@/lib/services/revenue";

export async function GET(request: Request) {
  try {
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
    return jsonOk({ summary });
  } catch (error) {
    return jsonError(error);
  }
}
