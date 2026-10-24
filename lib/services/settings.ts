import { getBuildInfo } from "@/lib/build-info";
import { getAppUrl, getPaymentMode } from "@/lib/payments";
import { runtimeEnv, runtimeEnvMeta } from "@/lib/env/runtime";
import { getRouterAdapterMode } from "@/lib/router";
import { getMikroTikConfigFromEnv } from "@/lib/router/mikrotik-rest";
import { listHotspotsByOwner } from "@/lib/repositories/hotspots";
import { listPackagesByOwner } from "@/lib/repositories/packages";
import { listRoutersByOwner } from "@/lib/repositories/routers";
import { listSessionsByHotspotIds } from "@/lib/repositories/sessions";
import * as userRepo from "@/lib/repositories/users";
import {
  authMode,
  requireUser,
  updateCurrentUserProfile,
} from "@/lib/services/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SettingsPayload } from "@/lib/types";
import {
  freeModeUpdateSchema,
  passwordChangeSchema,
  profileUpdateSchema,
} from "@/lib/validations";
import { freeModeStatus, updateFreeMode } from "@/lib/services/free-mode";

export async function getSettings(): Promise<SettingsPayload> {
  const user = await requireUser();
  const profile = await userRepo.findUserById(user.id);
  if (!profile) throw new Error("Unauthorized");

  const hotspots = await listHotspotsByOwner(user.id);
  const packages = await listPackagesByOwner(user.id);
  const routers = await listRoutersByOwner(user.id);
  const hotspotIds = hotspots.map((h) => h.id);
  const sessions = await listSessionsByHotspotIds(hotspotIds);
  const now = Date.now();
  const activeSessions = sessions.filter(
    (s) => s.status === "active" && new Date(s.endsAt).getTime() > now,
  ).length;

  const appUrl = getAppUrl();
  const paymentMode = getPaymentMode();
  const adapterMode = getRouterAdapterMode();
  const mikrotikCfg = getMikroTikConfigFromEnv();
  const routersConfigured = routers.filter(
    (r) =>
      r.adapterType === "mikrotik" &&
      Boolean(r.host?.trim() && r.username?.trim()),
  ).length;

  const wgIp = runtimeEnv("WIREGUARD_VPS_PUBLIC_IP") ?? null;
  const wgPub = runtimeEnv("WIREGUARD_VPS_PUBLIC_KEY") ?? null;
  const wgPeerPriv = runtimeEnv("WIREGUARD_PEER_PRIVATE_KEY") ?? null;
  const build = getBuildInfo();
  const envMeta = runtimeEnvMeta();
  const publicProfile = userRepo.toPublic(profile);

  return {
    profile: publicProfile,
    freeMode: freeModeStatus(publicProfile),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
    })),
    runtime: {
      paymentMode,
      appUrl,
      webhookUrl: `${appUrl}/api/payments/webhook`,
      paystackConfigured: Boolean(runtimeEnv("PAYSTACK_SECRET_KEY")),
      routerDefaultAdapter: adapterMode,
      deploymentMode: "single-company",
      authMode: authMode(),
      buildNumber: build.number,
      buildAt: build.builtAt,
      mikrotik: {
        adapterMode,
        configured: Boolean(mikrotikCfg) || routersConfigured > 0,
        host: mikrotikCfg?.host ?? null,
        routersConfigured,
      },
      wireguard: {
        vpsPublicIp: wgIp,
        vpsPublicKey: wgPub,
        peerPrivateKey: wgPeerPriv,
        serverAddress: runtimeEnv("WIREGUARD_SERVER_ADDRESS") || "10.8.0.1",
        peerAddress: runtimeEnv("WIREGUARD_PEER_ADDRESS") || "10.8.0.2",
        listenPort: Number(runtimeEnv("WIREGUARD_LISTEN_PORT") || 51820),
        scriptReady: Boolean(wgIp && wgPub && wgPeerPriv),
        present: {
          vpsPublicIp: Boolean(wgIp),
          vpsPublicKey: Boolean(wgPub),
          peerPrivateKey: Boolean(wgPeerPriv),
        },
        envCwd: envMeta.cwd,
        envFilesLoaded: envMeta.filesLoaded,
      },
    },
    stats: {
      hotspots: hotspots.length,
      packages: packages.length,
      routers: routers.length,
      activeSessions,
    },
  };
}

export async function updateProfile(raw: unknown) {
  const data = profileUpdateSchema.parse(raw);
  return updateCurrentUserProfile({
    name: data.name,
    businessName: data.businessName,
    phone: data.phone,
    supportEmail: data.supportEmail,
    currency: data.currency.toUpperCase(),
    timezone: data.timezone,
    notifyPaymentSuccess: data.notifyPaymentSuccess,
    notifySessionExpired: data.notifySessionExpired,
    notifySystem: data.notifySystem,
  });
}

export { updateFreeMode, freeModeUpdateSchema };

export async function changePassword(raw: unknown) {
  const user = await requireUser();
  const data = passwordChangeSchema.parse(raw);

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.currentPassword,
  });
  if (verifyError) {
    throw new Error("Current password is incorrect");
  }
  const { error } = await supabase.auth.updateUser({
    password: data.newPassword,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function probeMikroTik() {
  await requireUser();
  const { testMikroTikConnection } = await import("@/lib/router");
  return testMikroTikConnection();
}
