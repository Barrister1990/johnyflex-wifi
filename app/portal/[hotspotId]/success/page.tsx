import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SessionCountdown } from "@/components/portal-session-countdown";
import { PortalLiveSpeed } from "@/components/portal-live-speed";
import { PortalAutoUnlock } from "@/components/portal-auto-unlock";
import { PortalRememberAccess } from "@/components/portal-remember-access";
import { RetryUnlockButton } from "@/components/portal-retry-unlock";
import { portalPath } from "@/lib/hotspots/slug";
import { getSuccessContext } from "@/lib/services/sessions";

type Props = {
  params: Promise<{ hotspotId: string }>;
  searchParams: Promise<{
    reference?: string;
    unlock?: string;
    note?: string;
  }>;
};

function matchesHotspot(
  hotspot: { id: string; slug: string },
  slugOrId: string,
) {
  return hotspot.id === slugOrId || hotspot.slug === slugOrId;
}

export default async function PortalSuccessPage({
  params,
  searchParams,
}: Props) {
  const { hotspotId } = await params;
  const { reference, unlock, note } = await searchParams;
  const ctx = reference ? await getSuccessContext(reference) : null;
  const unlockPending =
    unlock === "pending" || (ctx ? ctx.unlockOk === false : false);

  if (!ctx || !matchesHotspot(ctx.hotspot, hotspotId)) {
    return (
      <div className="portal-page relative flex min-h-[100vh] items-center justify-center px-3 py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(90% 70% at 10% -10%, rgba(200,245,66,0.22), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(13,61,44,0.85), transparent 55%), linear-gradient(180deg, #041a12 0%, #0d3d2c 55%, #041a12 100%)",
            }}
          />
        <div className="portal-shell w-full max-w-[22rem] text-center sm:max-w-md">
          <div className="rounded-[1rem] border border-border bg-[#f3f6f3] px-5 py-6 shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)]">
            <span className="portal-brand-mark mx-auto mb-3">JF</span>
            <h1 className="font-display text-[1.65rem] leading-tight tracking-tight text-brand-ink">
              Session not found
            </h1>
            <p className="mt-2 text-[12px] text-secondary">
              We could not confirm your payment. If you were charged, contact
              the venue with your payment reference
              {reference ? (
                <>
                  {" "}
                  (<span className="font-mono">{reference}</span>)
                </>
              ) : null}
              .
            </p>
            {reference ? (
              <div className="mt-3">
                <RetryUnlockButton reference={reference} />
              </div>
            ) : null}
            <Link href={`/portal/${hotspotId}`} className="mt-4 inline-block">
              <Button size="sm" variant="secondary">
                Back to portal
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ends = new Date(ctx.session.endsAt).toLocaleString();

  return (
    <div className="portal-page relative flex min-h-[100vh] items-start justify-center px-3 pb-8 pt-6 sm:items-center sm:px-4 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(90% 70% at 10% -10%, rgba(200,245,66,0.22), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(13,61,44,0.85), transparent 55%), linear-gradient(180deg, #041a12 0%, #0d3d2c 55%, #041a12 100%)",
        }}
      />
      <div className="portal-shell w-full max-w-[22rem] sm:max-w-md">
        <div className="animate-fade-up rounded-[1rem] border border-border bg-[#f3f6f3] shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)]">
          <div className="px-4 py-5 sm:px-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="portal-brand-mark">JF</span>
              <p className="font-display text-[14px] font-bold tracking-[-0.03em] text-brand-ink">
                JohnnyFlex
              </p>
            </div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: unlockPending ? "#0d3d2c" : "#16a34a" }}
            >
              {unlockPending ? "Paid" : "Connected"}
            </p>
            <h1 className="font-display mt-1 text-[1.75rem] leading-[1.05] tracking-tight text-brand-ink">
              {unlockPending ? "Payment received" : "You're online"}
            </h1>
            <p className="mt-1.5 text-[12px] leading-snug text-secondary">
              {ctx.pkg.name} at {ctx.hotspot.name}
            </p>

            <PortalRememberAccess
              reference={ctx.payment.reference}
              ownerId={ctx.hotspot.ownerId}
              endsAt={ctx.session.endsAt}
            />

            {unlockPending ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-950">
                <p className="text-[11px] font-semibold">
                  Wi‑Fi unlock needs a moment
                </p>
                <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                  {note ||
                    ctx.unlockError ||
                    "Stay on the café Wi‑Fi. If you are not online shortly, tap retry or ask the venue with your reference."}
                </p>
                <RetryUnlockButton
                  reference={ctx.payment.reference}
                  macAddress={ctx.payment.clientMac}
                />
              </div>
            ) : (
              <>
                <PortalAutoUnlock
                  reference={ctx.payment.reference}
                  macAddress={ctx.payment.clientMac}
                />
                <div className="mt-4 rounded-2xl bg-land-yellow/70 px-3.5 py-3 text-land-ink">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">
                    Package time
                  </p>
                  <SessionCountdown endsAt={ctx.session.endsAt} />
                  <p className="mt-1 text-[10px] opacity-70">Until {ends}</p>
                </div>
                <PortalLiveSpeed speedProfile={ctx.pkg.speedProfile} />
              </>
            )}

            <div className="mt-4 space-y-2 rounded-xl border border-border/80 bg-white/70 px-3 py-2.5 text-left">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">
                  Reference
                </p>
                <p className="mt-0.5 font-mono text-[11px]">
                  {ctx.payment.reference}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">
                  Network
                </p>
                <p className="mt-0.5 font-mono text-[11px] font-medium">
                  {ctx.hotspot.ssid}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Access ends automatically when the timer runs out. Stay connected
              to {ctx.hotspot.ssid}.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={portalPath(ctx.hotspot, "/account")}>
                <Button size="sm" variant="secondary">
                  My account
                </Button>
              </Link>
              <Link href={portalPath(ctx.hotspot)}>
                <Button size="sm" variant="secondary">
                  Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
