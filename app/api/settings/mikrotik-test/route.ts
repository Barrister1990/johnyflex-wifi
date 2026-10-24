import { jsonError, jsonOk } from "@/lib/api";
import { probeMikroTik } from "@/lib/services/settings";

export async function POST() {
  try {
    const result = await probeMikroTik();
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
