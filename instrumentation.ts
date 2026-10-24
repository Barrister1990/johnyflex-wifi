export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Cut off expired Wi‑Fi access every minute (package timer + MikroTik revoke).
  // Complements optional external cron at /api/cron/expire.
  const { processExpiredSessions, processExpiredSubscriptions } = await import(
    "@/lib/services/session-expiry"
  );
  const { syncActiveSessionUsage } = await import(
    "@/lib/services/session-usage"
  );

  const tickExpire = async () => {
    try {
      await processExpiredSessions();
      await processExpiredSubscriptions();
    } catch (err) {
      console.error("[wifihub] expire worker", err);
    }
  };

  const tickUsage = async () => {
    try {
      await syncActiveSessionUsage();
    } catch (err) {
      console.error("[wifihub] usage worker", err);
    }
  };

  // Stagger first run so boot is not blocked
  setTimeout(() => {
    void tickExpire();
    setInterval(() => void tickExpire(), 60_000);
  }, 15_000);

  // Sample MikroTik Hotspot Active bytes every 2 minutes
  setTimeout(() => {
    void tickUsage();
    setInterval(() => void tickUsage(), 120_000);
  }, 45_000);
}
