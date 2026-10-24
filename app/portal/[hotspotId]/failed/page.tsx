import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ hotspotId: string }>;
  searchParams: Promise<{ reference?: string; reason?: string }>;
};

export default async function PortalFailedPage({
  params,
  searchParams,
}: Props) {
  const { hotspotId } = await params;
  const { reference, reason } = await searchParams;

  return (
    <div className="portal-page relative flex min-h-[100vh] items-center justify-center px-3 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(90% 70% at 10% -10%, rgba(200,245,66,0.18), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(13,61,44,0.85), transparent 55%), linear-gradient(180deg, #041a12 0%, #0d3d2c 55%, #041a12 100%)",
        }}
      />
      <div className="portal-shell w-full max-w-[22rem] sm:max-w-md">
        <div className="animate-fade-up rounded-[1rem] border border-border bg-[#f3f6f3] px-5 py-6 text-center shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)]">
          <span className="portal-brand-mark mx-auto mb-3">JF</span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-danger">
            Payment failed
          </p>
          <h1 className="font-display mt-1 text-[1.65rem] leading-tight tracking-tight text-brand-ink">
            Could not activate internet
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-secondary">
            {reason ||
              "The payment was not completed. You can try again from the portal."}
          </p>
          {reference ? (
            <p className="mt-3 font-mono text-[10px] text-muted">
              Ref: {reference}
            </p>
          ) : null}
          <Link href={`/portal/${hotspotId}`} className="mt-5 inline-block">
            <Button size="sm">Try again</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
