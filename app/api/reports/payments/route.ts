import { jsonError } from "@/lib/api";
import { buildPaymentsCsv } from "@/lib/services/reports";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const csv = await buildPaymentsCsv({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      hotspotId: url.searchParams.get("hotspotId"),
    });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="wifihub-payments.csv"',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
