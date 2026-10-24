import { runtimeEnv } from "@/lib/env/runtime";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { PaystackPaymentProvider } from "@/lib/payments/paystack";
import type { PaymentProviderClient } from "@/lib/payments/types";

export function getPaymentMode(): "mock" | "paystack" {
  const mode = (runtimeEnv("PAYMENT_MODE") ?? "mock").toLowerCase();
  return mode === "paystack" ? "paystack" : "mock";
}

/** Public site URL for QR codes, Paystack callbacks, and portal links. */
export function getAppUrl(): string {
  return (
    runtimeEnv("APP_URL")?.replace(/\/$/, "") ||
    runtimeEnv("NEXT_PUBLIC_APP_URL")?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/**
 * Prefer configured APP_URL; otherwise derive from proxy headers or the
 * incoming request (avoids http://127.0.0.1:3000 behind Nginx).
 */
export function resolvePublicOrigin(request: Request): string {
  const configured = getAppUrl();
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
  }

  const host = request.headers.get("host")?.trim();
  if (host && !/localhost|127\.0\.0\.1/i.test(host)) {
    return `${forwardedProto}://${host}`.replace(/\/$/, "");
  }

  return configured;
}

export function getPaymentProvider(): PaymentProviderClient {
  if (getPaymentMode() === "paystack") {
    const secret = runtimeEnv("PAYSTACK_SECRET_KEY");
    const webhook =
      runtimeEnv("PAYSTACK_WEBHOOK_SECRET") ?? secret ?? "";
    if (!secret) {
      throw new Error(
        "PAYMENT_MODE=paystack requires PAYSTACK_SECRET_KEY",
      );
    }
    return new PaystackPaymentProvider(secret, webhook);
  }
  return new MockPaymentProvider();
}
