export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Escape hatch when in-process workers starve the HTTP connection pool
  // (common on small VPS with slow/unreachable MikroTik REST).
  if (
    process.env.DISABLE_INPROCESS_WORKERS === "1" ||
    process.env.DISABLE_INPROCESS_WORKERS === "true"
  ) {
    console.info(
      "[johnnyflex] in-process expire/usage workers disabled (DISABLE_INPROCESS_WORKERS)",
    );
    return;
  }

  // Cut off expired Wi‑Fi access periodically (package timer + MikroTik revoke).
  // Complements optional external cron at /api/cron/expire.
  const { processExpiredSessions, processExpiredSubscriptions } = await import(
    "@/lib/services/session-expiry"
  );
  const { syncActiveSessionUsage } = await import(
    "@/lib/services/session-usage"
  );

  let expireRunning = false;
  let usageRunning = false;

  const tickExpire = async () => {
    if (expireRunning) return;
    expireRunning = true;
    try {
      await processExpiredSessions();
      await processExpiredSubscriptions();
    } catch (err) {
      console.error("[wifihub] expire worker", err);
    } finally {
      expireRunning = false;
    }
  };

  const tickUsage = async () => {
    if (usageRunning) return;
    usageRunning = true;
    try {
      await syncActiveSessionUsage();
    } catch (err) {
      console.error("[wifihub] usage worker", err);
    } finally {
      usageRunning = false;
    }
  };

  // Longer intervals + no overlap so hung MikroTik calls cannot pile up
  // and exhaust undici's connection pool (which then makes portal SSR hang).
  setTimeout(() => {
    void tickExpire();
    setInterval(() => void tickExpire(), 120_000);
  }, 30_000);

  setTimeout(() => {
    void tickUsage();
    setInterval(() => void tickUsage(), 300_000);
  }, 90_000);
}
