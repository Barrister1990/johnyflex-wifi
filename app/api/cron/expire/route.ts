import { jsonError, jsonOk } from "@/lib/api";
import { runtimeEnv } from "@/lib/env/runtime";
import {
  processExpiredSessions,
  processExpiredSubscriptions,
} from "@/lib/services/session-expiry";
import { syncActiveSessionUsage } from "@/lib/services/session-usage";

/**
 * Expire due sessions (revoke MikroTik) and monthly plans (no auto-renew).
 * Also samples Hotspot Active byte counters into sessions.
 * Protect with CRON_SECRET (Authorization: Bearer …).
 *
 * Preferred scheduler: Supabase Edge Function `expire-sessions` via
 * pg_cron + pg_net (migration 008_expire_sessions_cron.sql).
 *
 * Manual test:
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" https://your.domain/api/cron/expire
 */
export async function POST(request: Request) {
  try {
    const secret = runtimeEnv("CRON_SECRET");
    if (secret) {
      const auth = request.headers.get("authorization") ?? "";
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token !== secret) {
        return jsonError(new Error("Unauthorized"), 401);
      }
    }

    const usage = await syncActiveSessionUsage();
    const sessions = await processExpiredSessions();
    const subscriptions = await processExpiredSubscriptions();
    return jsonOk({ usage, sessions, subscriptions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
