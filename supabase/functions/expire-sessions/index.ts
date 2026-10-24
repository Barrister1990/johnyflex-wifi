/**
 * WiFiHub — expire due sessions by calling the VPS app.
 *
 * MikroTik revoke must run on the VPS (WireGuard), so this function only
 * proxies to POST {WIFIHUB_APP_URL}/api/cron/expire.
 *
 * Secrets (supabase secrets set …):
 *   WIFIHUB_APP_URL      e.g. https://wifi.edumatetechnologies.com
 *   WIFIHUB_CRON_SECRET  same value as CRON_SECRET on the VPS
 *
 * Invoked by pg_cron every 5 minutes (migration 008_expire_sessions_cron.sql).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const appUrl = (Deno.env.get("WIFIHUB_APP_URL") ?? "").replace(/\/$/, "");
    const cronSecret = Deno.env.get("WIFIHUB_CRON_SECRET") ?? "";

    if (!appUrl) {
      return Response.json(
        { error: "WIFIHUB_APP_URL is not set" },
        { status: 500 },
      );
    }
    if (!cronSecret) {
      return Response.json(
        { error: "WIFIHUB_CRON_SECRET is not set" },
        { status: 500 },
      );
    }

    const res = await fetch(`${appUrl}/api/cron/expire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: "{}",
    });

    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }

    if (!res.ok) {
      console.error("[expire-sessions] app returned", res.status, body);
      return Response.json(
        { error: "Expire endpoint failed", status: res.status, body },
        { status: 502 },
      );
    }

    return Response.json({ ok: true, result: body });
  } catch (error) {
    console.error("[expire-sessions]", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
});
