import { NextResponse } from "next/server";
import { getBuildInfo } from "@/lib/build-info";
import { runtimeEnv, runtimeEnvMeta } from "@/lib/env/runtime";

/**
 * Public health check for uptime monitors (no secrets).
 * GET /api/health
 */
export async function GET() {
  const build = getBuildInfo();
  const envMeta = runtimeEnvMeta();
  const appUrl = runtimeEnv("APP_URL") || runtimeEnv("NEXT_PUBLIC_APP_URL") || null;
  const paymentMode = (runtimeEnv("PAYMENT_MODE") ?? "mock").toLowerCase();
  const emailReady = Boolean(
    runtimeEnv("RESEND_API_KEY") &&
      (runtimeEnv("EMAIL_FROM") || runtimeEnv("RESEND_FROM")),
  );

  return NextResponse.json({
    ok: true,
    service: "wifihub",
    time: new Date().toISOString(),
    build: {
      number: build.number,
      builtAt: build.builtAt,
    },
    appUrl,
    paymentMode: paymentMode === "paystack" ? "paystack" : "mock",
    emailConfigured: emailReady,
    env: {
      cwd: envMeta.cwd,
      filesLoaded: envMeta.filesLoaded.length,
    },
  });
}
