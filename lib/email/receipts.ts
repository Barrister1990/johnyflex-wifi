import { runtimeEnv } from "@/lib/env/runtime";
import { getAppUrl } from "@/lib/payments";

export type ReceiptEmailInput = {
  to: string;
  hotspotName: string;
  packageName: string;
  amount: number;
  currency: string;
  reference: string;
  provider: string;
};

/**
 * Send a receipt email when RESEND_API_KEY + EMAIL_FROM are set.
 * No-op (returns skipped) when email is not configured — portal print still works.
 */
export async function sendReceiptEmail(
  input: ReceiptEmailInput,
): Promise<{ sent: boolean; skipped?: string }> {
  const apiKey = runtimeEnv("RESEND_API_KEY");
  const from =
    runtimeEnv("EMAIL_FROM") || runtimeEnv("RESEND_FROM") || "";

  if (!apiKey || !from) {
    return {
      sent: false,
      skipped: "Email not configured (set RESEND_API_KEY and EMAIL_FROM)",
    };
  }

  const appUrl = getAppUrl();
  const subject = `JohnnyFlex receipt · ${input.reference}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f1115;max-width:480px">
      <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5c6b63">JohnnyFlex</p>
      <h1 style="font-size:22px;margin:8px 0 4px">Payment receipt</h1>
      <p style="color:#5b5f6a;font-size:14px">${input.hotspotName}</p>
      <table style="width:100%;margin-top:20px;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#8a8f98">Package</td><td style="padding:6px 0;text-align:right">${input.packageName}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8f98">Amount</td><td style="padding:6px 0;text-align:right">${input.currency} ${input.amount.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8f98">Reference</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px">${input.reference}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8f98">Provider</td><td style="padding:6px 0;text-align:right">${input.provider}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#8a8f98">Manage your session: <a href="${appUrl}">${appUrl}</a></p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Receipt email failed: ${text.slice(0, 160) || res.status}`);
  }

  return { sent: true };
}
