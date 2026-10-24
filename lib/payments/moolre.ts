import { timingSafeEqual } from "crypto";
import { runtimeEnv } from "@/lib/env/runtime";
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProviderClient,
  VerifyPaymentResult,
} from "@/lib/payments/types";

function appUrl(): string {
  return (
    runtimeEnv("APP_URL")?.replace(/\/$/, "") ||
    runtimeEnv("NEXT_PUBLIC_APP_URL")?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

type MoolreLinkResponse = {
  status: number;
  code?: string;
  message?: string;
  data?: {
    authorization_url?: string;
    reference?: string;
  };
};

type MoolreStatusResponse = {
  status: number;
  code?: string;
  message?: string;
  data?: {
    txstatus?: number;
    accountnumber?: string;
    amount?: string;
    value?: string;
    transactionid?: string | number | null;
    externalref?: string;
    thirdpartyref?: string;
    ts?: string;
  };
};

function formatAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

function safeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export class MoolrePaymentProvider implements PaymentProviderClient {
  readonly name = "moolre" as const;

  constructor(
    private readonly apiUser: string,
    private readonly publicKey: string,
    private readonly accountNumber: string,
    private readonly callbackSecret: string,
    private readonly baseUrl: string,
  ) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-USER": this.apiUser,
        "X-API-PUBKEY": this.publicKey,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      throw new Error(json.message || `Moolre HTTP ${res.status}`);
    }
    return json as T;
  }

  async initialize(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const redirect = new URL(input.callbackUrl);
    redirect.searchParams.set("reference", input.reference);
    redirect.searchParams.set("trxref", input.reference);

    const body = await this.request<MoolreLinkResponse>("/embed/link", {
      type: 1,
      amount: formatAmount(input.amount),
      email: input.email,
      externalref: input.reference,
      callback: `${appUrl()}/api/payments/moolre/webhook`,
      redirect: redirect.toString(),
      reusable: "0",
      currency: input.currency.toUpperCase(),
      accountnumber: this.accountNumber,
      metadata: input.metadata ?? {},
    });

    const authorizationUrl = body.data?.authorization_url;
    if (body.status !== 1 || !authorizationUrl) {
      throw new Error(body.message || "Moolre payment link generation failed");
    }

    return {
      authorizationUrl,
      reference: body.data?.reference || input.reference,
    };
  }

  async verify(reference: string): Promise<VerifyPaymentResult> {
    const body = await this.request<MoolreStatusResponse>(
      "/open/transact/status",
      {
        type: 1,
        idtype: 1,
        id: reference,
        accountnumber: this.accountNumber,
      },
    );

    const data = body.data;
    if (!data) {
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

    const externalRef = String(data.externalref ?? "");
    const accountOk =
      !data.accountnumber ||
      String(data.accountnumber) === this.accountNumber;
    const refOk = !externalRef || externalRef === reference;
    const txOk = Number(data.txstatus) === 1;
    const success = body.status === 1 && txOk && accountOk && refOk;

    let providerStatus = "pending";
    if (Number(data.txstatus) === 1) providerStatus = "success";
    else if (Number(data.txstatus) === 2) providerStatus = "failed";

    const amount = Number.parseFloat(String(data.amount ?? "0")) || 0;

    return {
      success,
      providerStatus,
      reference: externalRef || reference,
      providerRef:
        data.transactionid != null ? String(data.transactionid) : null,
      amount,
      currency: "GHS",
      metadata: {},
      raw: body,
    };
  }

  /**
   * Moolre puts the shared secret in the webhook JSON (`data.secret`),
   * not a signature header. Pass that value as `signature`.
   */
  verifyWebhookSignature(_rawBody: string, signature: string | null): boolean {
    if (!this.callbackSecret) {
      if (process.env.NODE_ENV === "production") return false;
      console.warn(
        "[moolre] MOOLRE_CALLBACK_SECRET missing — accepting webhook in non-production",
      );
      return true;
    }
    if (!signature) return false;
    return safeEqual(signature, this.callbackSecret);
  }
}
