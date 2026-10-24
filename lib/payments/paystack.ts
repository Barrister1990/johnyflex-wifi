import { createHmac, timingSafeEqual } from "crypto";
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProviderClient,
  VerifyPaymentResult,
} from "@/lib/payments/types";

type PaystackInitResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    id: number;
    metadata?: Record<string, unknown> | null;
    customer?: { email?: string };
  };
};

function flattenMetadata(
  meta: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return out;
}

export class PaystackPaymentProvider implements PaymentProviderClient {
  readonly name = "paystack" as const;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as T & { message?: string; status?: boolean };
    if (!res.ok) {
      throw new Error(
        (json as { message?: string }).message ||
          `Paystack HTTP ${res.status}`,
      );
    }
    return json as T;
  }

  async initialize(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    // Paystack expects amount in the smallest currency unit (pesewas for GHS)
    const amountKobo = Math.round(input.amount * 100);
    const body = await this.request<PaystackInitResponse>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: amountKobo,
          currency: input.currency.toUpperCase(),
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: {
            ...input.metadata,
            custom_fields: [
              {
                display_name: "Hotspot",
                variable_name: "hotspotId",
                value: input.metadata?.hotspotId ?? "",
              },
            ],
          },
        }),
      },
    );

    if (!body.status || !body.data) {
      throw new Error(body.message || "Paystack initialize failed");
    }

    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
      accessCode: body.data.access_code,
    };
  }

  async verify(reference: string): Promise<VerifyPaymentResult> {
    const body = await this.request<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    if (!body.status || !body.data) {
      return {
        success: false,
        providerStatus: "unknown",
        reference,
        providerRef: null,
        amount: 0,
        currency: "GHS",
        metadata: {},
        raw: body,
      };
    }

    const providerStatus = (body.data.status || "").toLowerCase();
    return {
      success: providerStatus === "success",
      providerStatus,
      reference: body.data.reference,
      providerRef: String(body.data.id),
      amount: body.data.amount / 100,
      currency: body.data.currency,
      metadata: flattenMetadata(
        body.data.metadata as Record<string, unknown> | null,
      ),
      raw: body,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature || !this.webhookSecret) return false;
    const hash = createHmac("sha512", this.webhookSecret)
      .update(rawBody)
      .digest("hex");
    try {
      const a = Buffer.from(hash);
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** List transactions (amounts in major units). */
  async listTransactions(opts?: {
    from?: string;
    to?: string;
    status?: string;
    perPage?: number;
    page?: number;
  }): Promise<{
    rows: Array<{
      id: number;
      status: string;
      reference: string;
      amount: number;
      fees: number;
      currency: string;
      channel: string | null;
      paidAt: string | null;
      customerEmail: string | null;
    }>;
    meta: unknown;
  }> {
    const params = new URLSearchParams();
    params.set("perPage", String(opts?.perPage ?? 50));
    params.set("page", String(opts?.page ?? 1));
    if (opts?.from) params.set("from", opts.from.slice(0, 10));
    if (opts?.to) params.set("to", opts.to.slice(0, 10));
    if (opts?.status) params.set("status", opts.status);

    const body = await this.request<{
      status: boolean;
      message: string;
      data?: Array<Record<string, unknown>>;
      meta?: unknown;
    }>(`/transaction?${params.toString()}`);

    const rows = (body.data ?? []).map((t) => ({
      id: Number(t.id),
      status: String(t.status ?? ""),
      reference: String(t.reference ?? ""),
      amount: Number(t.amount ?? 0) / 100,
      fees: Number(t.fees ?? 0) / 100,
      currency: String(t.currency ?? "GHS"),
      channel: t.channel != null ? String(t.channel) : null,
      paidAt:
        (t.paid_at as string | null) ??
        (t.paidAt as string | null) ??
        null,
      customerEmail:
        (t.customer as { email?: string } | undefined)?.email ?? null,
    }));

    return { rows, meta: body.meta ?? null };
  }

  /** Settlements / payouts to bank (amounts in major units). */
  async listSettlements(opts?: {
    from?: string;
    to?: string;
    status?: string;
    perPage?: number;
    page?: number;
  }): Promise<{
    rows: Array<{
      id: number;
      status: string;
      currency: string;
      amount: number;
      totalAmount: number;
      effectiveAmount: number;
      deductedAmount: number;
      settlementDate: string | null;
      payoutDate: string | null;
    }>;
    meta: unknown;
  }> {
    const params = new URLSearchParams();
    params.set("perPage", String(opts?.perPage ?? 50));
    params.set("page", String(opts?.page ?? 1));
    if (opts?.from) params.set("from", opts.from.slice(0, 10));
    if (opts?.to) params.set("to", opts.to.slice(0, 10));
    if (opts?.status) params.set("status", opts.status);

    const body = await this.request<{
      status: boolean;
      message: string;
      data?: Array<Record<string, unknown>>;
      meta?: unknown;
    }>(`/settlement?${params.toString()}`);

    const rows = (body.data ?? []).map((s) => ({
      id: Number(s.id),
      status: String(s.status ?? ""),
      currency: String(s.currency ?? "GHS"),
      amount: Number(s.amount ?? 0) / 100,
      totalAmount: Number(s.total_amount ?? s.totalAmount ?? 0) / 100,
      effectiveAmount:
        Number(s.effective_amount ?? s.effectiveAmount ?? 0) / 100,
      deductedAmount:
        Number(s.deducted_amount ?? s.deductedAmount ?? 0) / 100,
      settlementDate:
        (s.settlement_date as string | null) ??
        (s.settlementDate as string | null) ??
        null,
      payoutDate:
        (s.paid_at as string | null) ??
        (s.payout_date as string | null) ??
        null,
    }));

    return { rows, meta: body.meta ?? null };
  }
}
