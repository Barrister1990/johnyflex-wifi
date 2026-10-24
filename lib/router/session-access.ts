import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { getRouterAdapter } from "@/lib/router";
import {
  mikrotikAddIpBinding,
  mikrotikApplySimpleQueue,
  mikrotikRemoveActiveByMac,
  mikrotikRemoveHotspotHostByMac,
  mikrotikRemoveHotspotUserForSession,
  mikrotikRemoveIpBindingByMac,
  mikrotikRemoveIpBindingBySessionId,
  mikrotikRemoveSimpleQueueByName,
  mikrotikUpsertTimedHotspotUser,
} from "@/lib/router/mikrotik-rest";
import { resolveMikroTikConfigForHotspot } from "@/lib/router/resolve-config";

export type SessionAccessInput = {
  hotspotId: string;
  sessionId: string;
  macAddress: string;
  speedProfile?: string;
  endsAt?: string;
};

function queueNameForSession(sessionId: string) {
  return `wh-${sessionId.replace(/-/g, "").slice(0, 12)}`;
}

/** True when this hotspot can unlock via RouterOS REST (wizard or env). */
export async function hotspotHasLiveMikroTik(
  hotspotId: string,
): Promise<boolean> {
  const { config } = await resolveMikroTikConfigForHotspot(hotspotId);
  return config != null;
}

/**
 * Unlock a client for the package duration.
 * Live MikroTik: bypassed IP binding first (instant internet), then timer/queue
 * in the background so the portal success page is not blocked ~30–50s.
 */
export async function authorizeSessionAccess(
  input: SessionAccessInput,
): Promise<void> {
  const mac = normalizeMac(input.macAddress) ?? input.macAddress;
  const adapter = getRouterAdapter();
  const { config, source } = await resolveMikroTikConfigForHotspot(
    input.hotspotId,
  );

  if (!config) {
    await adapter.authorizeDevice({
      macAddress: mac,
      sessionId: input.sessionId,
      hotspotId: input.hotspotId,
    });
    if (input.speedProfile && input.endsAt) {
      await adapter.createSession({
        sessionId: input.sessionId,
        hotspotId: input.hotspotId,
        macAddress: mac,
        speedProfile: input.speedProfile,
        endsAt: input.endsAt,
      });
      await adapter.applyBandwidthProfile(mac, input.speedProfile);
    }
    return;
  }

  if (!isUsableClientMac(mac)) {
    throw new Error(
      "Device MAC is missing. Connect to the hotspot Wi‑Fi so the captive portal can pass your MAC, then pay or redeem again.",
    );
  }

  if (!input.endsAt) {
    throw new Error("Session end time is required for MikroTik unlock");
  }

  const unlockTimeoutMs = 4_000;

  try {
    // Critical path — bypass binding opens internet; kicking host/active makes
    // captive browsers notice in ~1s instead of waiting for OS re-probe.
    await mikrotikAddIpBinding(
      config,
      {
        macAddress: mac,
        comment: `wh:${input.sessionId.slice(0, 8)}:${Math.floor(new Date(input.endsAt).getTime() / 1000)}`,
        type: "bypassed",
      },
      { timeoutMs: unlockTimeoutMs },
    );
    await Promise.all([
      mikrotikRemoveActiveByMac(config, mac, { timeoutMs: unlockTimeoutMs }),
      mikrotikRemoveHotspotHostByMac(config, mac, {
        timeoutMs: unlockTimeoutMs,
      }),
    ]);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "RouterOS REST failed";
    throw new Error(
      `Could not unlock Wi‑Fi on MikroTik (${source}): ${detail}`,
    );
  }

  // Non-blocking: package timer + bandwidth (expire worker still enforces endsAt).
  void finalizeMikroTikAccess(config, input, mac).catch((error) => {
    console.warn(
      "[wifihub] background MikroTik finalize",
      error instanceof Error ? error.message : error,
    );
  });

  // Keep mock/DB adapter in sync without a second live REST round-trip.
  await adapter.createSession({
    sessionId: input.sessionId,
    hotspotId: input.hotspotId,
    macAddress: mac,
    speedProfile: input.speedProfile ?? "default",
    endsAt: input.endsAt,
  });
}

async function finalizeMikroTikAccess(
  config: NonNullable<
    Awaited<ReturnType<typeof resolveMikroTikConfigForHotspot>>["config"]
  >,
  input: SessionAccessInput,
  mac: string,
): Promise<void> {
  const timeoutMs = 5_000;
  try {
    await mikrotikUpsertTimedHotspotUser(
      config,
      {
        sessionId: input.sessionId,
        macAddress: mac,
        endsAt: input.endsAt!,
        comment: `wifihub:${input.sessionId.slice(0, 8)}`,
        speedProfile: input.speedProfile,
      },
      { timeoutMs },
    );
  } catch (userErr) {
    console.warn(
      "[wifihub] hotspot user timer",
      userErr instanceof Error ? userErr.message : userErr,
    );
  }

  if (input.speedProfile) {
    await mikrotikApplySimpleQueue(
      config,
      {
        macAddress: mac,
        speedProfile: input.speedProfile,
        name: queueNameForSession(input.sessionId),
      },
      { timeoutMs },
    );
  }
}

export async function revokeSessionAccess(input: {
  hotspotId: string;
  sessionId: string;
  macAddress?: string | null;
}): Promise<void> {
  const mac = normalizeMac(input.macAddress) ?? input.macAddress ?? "";
  const adapter = getRouterAdapter();
  const { config } = await resolveMikroTikConfigForHotspot(input.hotspotId);

  if (mac) {
    await adapter.revokeDevice({
      macAddress: mac,
      sessionId: input.sessionId,
      hotspotId: input.hotspotId,
    });
    await adapter.disconnectDevice({
      macAddress: mac,
      sessionId: input.sessionId,
      hotspotId: input.hotspotId,
    });
  }
  await adapter.endSession(input.sessionId);

  if (config) {
    try {
      // Always remove by session tag — works even when device row has a synthetic MAC.
      await mikrotikRemoveIpBindingBySessionId(config, input.sessionId);
      await mikrotikRemoveHotspotUserForSession(config, input.sessionId);
      await mikrotikRemoveSimpleQueueByName(
        config,
        queueNameForSession(input.sessionId),
      );
      if (isUsableClientMac(mac)) {
        await mikrotikRemoveIpBindingByMac(config, mac);
        await mikrotikRemoveActiveByMac(config, mac);
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "RouterOS REST failed";
      throw new Error(`Could not revoke MikroTik access: ${detail}`);
    }
  }
}
