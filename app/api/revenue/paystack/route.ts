import { jsonError, jsonOk } from "@/lib/api";
import {
  getPaystackFinance,
  resolveRevenueRange,
} from "@/lib/services/revenue";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const preset = url.searchParams.get("preset") ?? "month";
    const fromParam = url.searchParams.get("from") ?? undefined;
    const toParam = url.searchParams.get("to") ?? undefined;
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");
    const range = resolveRevenueRange({
      preset,
      from: fromParam,
      to: toParam,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
    const data = await getPaystackFinance({
      from: range.fromIso,
      to: range.toIso,
    });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
