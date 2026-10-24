/** First-party cookie so remaining time can continue across sites/SSIDs. */
export const PORTAL_ROAM_COOKIE = "wifihub_roam";

export type PortalRoamCookie = {
  /** Latest successful payment/roam reference for this guest */
  reference: string;
  ownerId: string;
  endsAt: string;
};

export function parsePortalRoamCookie(
  raw: string | null | undefined,
): PortalRoamCookie | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<PortalRoamCookie>;
    if (
      !data.reference?.trim() ||
      !data.ownerId?.trim() ||
      !data.endsAt?.trim()
    ) {
      return null;
    }
    if (new Date(data.endsAt).getTime() <= Date.now()) return null;
    return {
      reference: data.reference.trim(),
      ownerId: data.ownerId.trim(),
      endsAt: data.endsAt.trim(),
    };
  } catch {
    return null;
  }
}

export function encodePortalRoamCookie(value: PortalRoamCookie): string {
  return encodeURIComponent(
    JSON.stringify({
      reference: value.reference,
      ownerId: value.ownerId,
      endsAt: value.endsAt,
    }),
  );
}

/** Max-age seconds until session ends (min 60s, max 30 days). */
export function portalRoamCookieMaxAge(endsAt: string): number {
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(60, Math.min(Math.ceil(ms / 1000), 60 * 60 * 24 * 30));
}

export function readPortalRoamCookieFromDocument(): PortalRoamCookie | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${PORTAL_ROAM_COOKIE}=`));
  if (!match) return null;
  return parsePortalRoamCookie(match.slice(PORTAL_ROAM_COOKIE.length + 1));
}

export function writePortalRoamCookieToDocument(value: PortalRoamCookie): void {
  if (typeof document === "undefined") return;
  const maxAge = portalRoamCookieMaxAge(value.endsAt);
  document.cookie = `${PORTAL_ROAM_COOKIE}=${encodePortalRoamCookie(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}
