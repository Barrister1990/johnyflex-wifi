import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProviderClient,
  VerifyPaymentResult,
} from "@/lib/payments/types";

export class MockPaymentProvider implements PaymentProviderClient {
  readonly name = "mock" as const;

  async initialize(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const url = new URL(input.callbackUrl);
    url.searchParams.set("reference", input.reference);
    url.searchParams.set("trxref", input.reference);
    return {
      authorizationUrl: url.toString(),
      reference: input.reference,
      accessCode: `mock_${input.reference}`,
    };
  }

  async verify(reference: string): Promise<VerifyPaymentResult> {
    return {
      success: true,
      providerStatus: "success",
      reference,
      providerRef: `mock_txn_${reference}`,
      amount: 0,
      currency: "GHS",
      metadata: {},
      raw: { provider: "mock", reference, status: "success" },
    };
  }

  verifyWebhookSignature(_rawBody: string, _signature: string | null): boolean {
    return true;
  }
}
