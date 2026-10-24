import { PortalCheckout } from "@/components/portal-checkout";
import { extractClientMac } from "@/lib/mac";
import { getPortalData } from "@/lib/services/sessions";

/** Free Mode toggles live — never serve a cached paywall to captive browsers. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ hotspotId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PORTAL_ATMOSPHERE =
  "radial-gradient(90% 70% at 10% -10%, rgba(200,245,66,0.22), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(13,61,44,0.85), transparent 55%), linear-gradient(180deg, #041a12 0%, #0d3d2c 55%, #041a12 100%)";

export default async function PortalPage({ params, searchParams }: Props) {
  const { hotspotId } = await params;
  const query = await searchParams;
  const initialMac = extractClientMac(query);
  const errorParam = query.error;
  const initialError = Array.isArray(errorParam)
    ? errorParam[0]
    : (errorParam ?? null);

  try {
    const { hotspot, packages, subscriptionPlans, theme, liveMikroTik, freeMode } =
      await getPortalData(hotspotId);
    const bgStyle = theme.backgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(160deg, rgba(4,26,18,0.88), rgba(13,61,44,0.82)), url(${theme.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;

    return (
      <div
        className="portal-page relative flex min-h-[100vh] items-stretch justify-center px-0 pt-[max(0.5rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:py-10"
        style={bgStyle}
      >
        {!theme.backgroundImageUrl ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: PORTAL_ATMOSPHERE }}
          />
        ) : null}
        <PortalCheckout
          hotspot={hotspot}
          packages={packages}
          subscriptionPlans={subscriptionPlans}
          theme={theme}
          initialMac={initialMac}
          initialError={initialError}
          requireMac={liveMikroTik}
          freeMode={freeMode}
        />
      </div>
    );
  } catch {
    return (
      <div
        className="portal-page flex min-h-[100vh] items-center justify-center px-4"
        style={{ background: PORTAL_ATMOSPHERE }}
      >
        <div className="max-w-[20rem] text-center">
          <span className="portal-brand-mark mx-auto mb-3">JF</span>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "#c8f542" }}
          >
            JohnnyFlex
          </p>
          <h1 className="font-display mt-2 text-[1.75rem] leading-tight tracking-tight text-white">
            Hotspot not found
          </h1>
          <p className="mt-2 text-[12px]" style={{ color: "rgba(200,245,66,0.65)" }}>
            This QR code is invalid or the hotspot was removed.
          </p>
        </div>
      </div>
    );
  }
}
