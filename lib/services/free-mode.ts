import * as paymentRepo from "@/lib/repositories/payments";
import {
  getHotspotById,
  getHotspotBySlugOrId,
  updateHotspot,
} from "@/lib/repositories/hotspots";
import {
  getPackageById,
  listEnabledPackagesByOwner,
} from "@/lib/repositories/packages";
import { getProfileByIdService, profileToPublic } from "@/lib/repositories/profiles";
import { isUsableClientMac, normalizeMac } from "@/lib/mac";
import { resolvePortalEmail } from "@/lib/portal-guest-email";
import { requireUser, updateCurrentUserProfile } from "@/lib/services/auth";
import { provisionAccessFromPayment } from "@/lib/services/payments";
import { expireActiveFreeModeSessions } from "@/lib/services/session-expiry";
import type { Hotspot, PortalFreeMode, PublicUser } from "@/lib/types";
import {
  freeAccessClaimSchema,
  freeModeUpdateSchema,
} from "@/lib/validations";

type FreeModeWindow = {
  freeModeEnabled: boolean;
  freeModeStartsAt: string | null;
  freeModeEndsAt: string | null;
  freeModePackageId: string | null;
  currency: string;
};

export function isFreeModeActive(
  profile: Pick<
    FreeModeWindow,
    "freeModeEnabled" | "freeModeStartsAt" | "freeModeEndsAt"
  >,
  now = Date.now(),
): boolean {
  if (!profile.freeModeEnabled) return false;
  if (!profile.freeModeStartsAt || !profile.freeModeEndsAt) return false;
  const start = new Date(profile.freeModeStartsAt).getTime();
  const end = new Date(profile.freeModeEndsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

export function freeModeStatus(profile: PublicUser) {
  return {
    enabled: profile.freeModeEnabled,
    active: isFreeModeActive(profile),
    startsAt: profile.freeModeStartsAt,
    endsAt: profile.freeModeEndsAt,
    packageId: profile.freeModePackageId,
  };
}

/** Prefer per-site Free Mode when enabled; otherwise owner-wide profile. */
export async function resolveFreeModeWindow(
  hotspot: Hotspot,
): Promise<FreeModeWindow> {
  const row = await getProfileByIdService(hotspot.ownerId);
  const profile = row ? profileToPublic(row) : null;
  const currency = profile?.currency || "GHS";

  if (hotspot.freeModeEnabled) {
    return {
      freeModeEnabled: true,
      freeModeStartsAt: hotspot.freeModeStartsAt,
      freeModeEndsAt: hotspot.freeModeEndsAt,
      freeModePackageId: hotspot.freeModePackageId,
      currency,
    };
  }

  return {
    freeModeEnabled: profile?.freeModeEnabled ?? false,
    freeModeStartsAt: profile?.freeModeStartsAt ?? null,
    freeModeEndsAt: profile?.freeModeEndsAt ?? null,
    freeModePackageId: profile?.freeModePackageId ?? null,
    currency,
  };
}

/** Normalize datetime-local / ISO into UTC ISO for storage. */
function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date/time");
  return d.toISOString();
}

export async function updateFreeMode(raw: unknown) {
  const data = freeModeUpdateSchema.parse(raw);
  const user = await requireUser();
  if (data.freeModeEnabled && data.freeModePackageId) {
    const pkg = await getPackageById(data.freeModePackageId, user.id);
    if (!pkg) throw new Error("Package not found");
  }

  const startsAt = toIsoOrNull(data.freeModeStartsAt);
  const endsAt = toIsoOrNull(data.freeModeEndsAt);

  if (data.hotspotId) {
    const hs = await getHotspotById(data.hotspotId, user.id);
    if (!hs) throw new Error("Hotspot not found");
    const updated = await updateHotspot(data.hotspotId, user.id, {
      freeModeEnabled: data.freeModeEnabled,
      freeModeStartsAt: startsAt,
      freeModeEndsAt: endsAt,
      freeModePackageId: data.freeModePackageId,
    });
    if (!updated) throw new Error("Could not update hotspot Free Mode");
    if (!data.freeModeEnabled) {
      await expireActiveFreeModeSessions(user.id, data.hotspotId);
    }
    return {
      freeModeEnabled: updated.freeModeEnabled,
      freeModeStartsAt: updated.freeModeStartsAt,
      freeModeEndsAt: updated.freeModeEndsAt,
      freeModePackageId: updated.freeModePackageId,
      hotspotId: updated.id,
    };
  }

  const profile = await updateCurrentUserProfile({
    freeModeEnabled: data.freeModeEnabled,
    freeModeStartsAt: startsAt,
    freeModeEndsAt: endsAt,
    freeModePackageId: data.freeModePackageId,
  });

  if (!data.freeModeEnabled) {
    await expireActiveFreeModeSessions(user.id);
  }

  return profile;
}

function freeModeOfferCopy(endsAt: string): {
  label: string;
  offer: string;
  durationLabel: string;
} {
  const end = new Date(endsAt);
  const now = new Date();
  const endLocal = end.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const sameDay =
    end.getFullYear() === now.getFullYear() &&
    end.getMonth() === now.getMonth() &&
    end.getDate() === now.getDate();
  const ms = Math.max(0, end.getTime() - now.getTime());
  const hours = Math.ceil(ms / 3_600_000);

  if (sameDay && end.getHours() >= 22) {
    return {
      label: "Free unlimited Wi‑Fi",
      offer: "Enjoy free unlimited internet for the rest of the day",
      durationLabel: `Until ${endLocal}`,
    };
  }
  if (hours <= 3) {
    return {
      label: "Free unlimited Wi‑Fi",
      offer: `Enjoy free unlimited internet for the next ${hours} hour${hours === 1 ? "" : "s"}`,
      durationLabel: `Until ${endLocal}`,
    };
  }
  if (hours <= 26) {
    return {
      label: "Free unlimited Wi‑Fi",
      offer: "Enjoy free unlimited internet for the rest of this promo",
      durationLabel: `Until ${endLocal}`,
    };
  }
  return {
    label: "Free unlimited Wi‑Fi",
    offer: "Enjoy free unlimited internet during this Free Mode window",
    durationLabel: `Until ${endLocal}`,
  };
}

export async function getOwnerFreeModeForHotspot(
  slugOrId: string,
): Promise<PortalFreeMode | null> {
  const hotspot = await getHotspotBySlugOrId(slugOrId);
  if (!hotspot) return null;
  const window = await resolveFreeModeWindow(hotspot);
  if (!isFreeModeActive(window) || !window.freeModeEndsAt) return null;
  const copy = freeModeOfferCopy(window.freeModeEndsAt);
  return {
    active: true,
    endsAt: window.freeModeEndsAt,
    label: copy.label,
    offer: copy.offer,
    durationLabel: copy.durationLabel,
    currency: window.currency,
  };
}

export async function claimFreeAccess(raw: unknown) {
  const data = freeAccessClaimSchema.parse(raw);
  const hotspot =
    (await getHotspotById(data.hotspotId)) ??
    (await getHotspotBySlugOrId(data.hotspotId));
  if (!hotspot || hotspot.status === "inactive") {
    throw new Error("Hotspot not found or inactive");
  }
  if (hotspot.status === "maintenance") {
    throw new Error(
      "This hotspot is under maintenance. Free access is paused — try again shortly.",
    );
  }

  const window = await resolveFreeModeWindow(hotspot);
  if (!isFreeModeActive(window) || !window.freeModeEndsAt) {
    throw new Error("Free Mode is not active right now");
  }

  const clientMac = normalizeMac(data.macAddress);
  if (!isUsableClientMac(clientMac)) {
    throw new Error(
      "Connect to this hotspot’s Wi‑Fi first so your device MAC is known, then try again.",
    );
  }

  let pkg = window.freeModePackageId
    ? await getPackageById(window.freeModePackageId, hotspot.ownerId)
    : null;
  if (!pkg?.enabled) {
    const enabled = await listEnabledPackagesByOwner(hotspot.ownerId);
    pkg = enabled[0] ?? null;
  }
  if (!pkg) {
    throw new Error(
      "Free Mode needs at least one package (for speed profile). Create a package in Packages.",
    );
  }

  const macTag = (clientMac ?? "guest").replace(/:/g, "").slice(-8);
  const email = await resolvePortalEmail(data.email, clientMac);

  const reference = `free_${hotspot.id.slice(0, 8)}_${macTag}_${Date.now().toString(36)}`;
  const payment = await paymentRepo.createPayment({
    reference,
    hotspotId: hotspot.id,
    packageId: pkg.id,
    customerEmail: email,
    amount: 0,
    currency: pkg.currency,
    provider: "free",
    status: "success",
    providerRef: `free-mode:${window.freeModeEndsAt}`,
    clientMac: isUsableClientMac(clientMac) ? clientMac : null,
  });

  const { session, unlockOk, unlockError } = await provisionAccessFromPayment(
    payment,
    {
      notifyTitle: "Free Mode access",
      notifyBody: `${email} connected free until ${window.freeModeEndsAt.slice(0, 16).replace("T", " ")}.`,
      href: "/sessions",
    },
    {
      endsAt: window.freeModeEndsAt,
      deferRouterUnlock: true,
    },
  );

  return {
    payment,
    session,
    package: pkg,
    hotspot,
    unlockOk,
    unlockError,
    freeUntil: window.freeModeEndsAt,
  };
}
