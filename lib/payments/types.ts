export type InitializePaymentInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
};

export type InitializePaymentResult = {
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
};

export type VerifyPaymentResult = {
  success: boolean;
  /** Raw Paystack transaction status: success | failed | abandoned | pending | … */
  providerStatus?: string;
  reference: string;
  providerRef: string | null;
  amount: number;
  currency: string;
  /** Custom metadata we sent at initialize (clientMac, paymentId, …). */
  metadata?: Record<string, string>;
  raw: unknown;
};

export interface PaymentProviderClient {
  readonly name: "mock" | "paystack";
  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verify(reference: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
}
