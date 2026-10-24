import { jsonError, jsonOk } from "@/lib/api";
import * as packageService from "@/lib/services/packages";

export async function GET() {
  try {
    const packages = await packageService.listPackages();
    return jsonOk({ packages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pkg = await packageService.createPackage(body);
    return jsonOk({ package: pkg }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
