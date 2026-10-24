"use client";

import { useEffect, useState } from "react";

function parsePlanMbps(speedProfile: string): number | null {
  const m =
    speedProfile.match(/(\d+(?:\.\d+)?)\s*mbit/i) ??
    speedProfile.match(/(\d+(?:\.\d+)?)\s*mbps/i) ??
    speedProfile.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatMbps(n: number) {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

async function measureDownloadMbps(): Promise<number> {
  const url = `/api/speedtest?t=${Date.now()}`;
  const start = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("speedtest failed");
  const buf = await res.arrayBuffer();
  const elapsedSec = Math.max((performance.now() - start) / 1000, 0.001);
  return (buf.byteLength * 8) / elapsedSec / 1_000_000;
}

type Props = {
  speedProfile: string;
};

export function PortalLiveSpeed({ speedProfile }: Props) {
  const planMbps = parsePlanMbps(speedProfile);
  const [liveMbps, setLiveMbps] = useState<number | null>(null);
  const [phase, setPhase] = useState<"testing" | "done" | "error">("testing");
  const [display, setDisplay] = useState(0);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    async function run() {
      setPhase("testing");
      setLiveMbps(null);
      setDisplay(0);
      try {
        await measureDownloadMbps().catch(() => 0);
        if (cancelled) return;
        const a = await measureDownloadMbps();
        if (cancelled) return;
        const b = await measureDownloadMbps();
        if (cancelled) return;
        const avg = (a + b) / 2;
        setLiveMbps(avg);
        setPhase("done");

        const started = performance.now();
        const duration = 700;
        function tick(now: number) {
          const t = Math.min(1, (now - started) / duration);
          const eased = 1 - (1 - t) ** 3;
          setDisplay(avg * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
          else setDisplay(avg);
        }
        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setPhase("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [runId]);

  const barPct = (() => {
    if (liveMbps == null) return phase === "testing" ? 35 : 0;
    if (planMbps) return Math.min(100, (liveMbps / planMbps) * 100);
    return Math.min(100, (liveMbps / 50) * 100);
  })();

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-land-ink/10 bg-gradient-to-br from-land-ink to-[#1c2430] px-3.5 py-3.5 text-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Live speed
          </p>
          <p className="font-display mt-0.5 text-[2rem] leading-none tracking-tight tabular-nums">
            {phase === "testing" && liveMbps == null
              ? "…"
              : phase === "error"
                ? "—"
                : formatMbps(display || liveMbps || 0)}
            <span className="ml-1 text-[0.85rem] font-sans font-medium text-white/60">
              Mbps
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Your plan
          </p>
          <p className="mt-1 text-[13px] font-semibold tabular-nums">
            {speedProfile}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-land-yellow transition-[width] duration-700 ease-out"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-white/55">
          {phase === "testing"
            ? "Measuring your connection…"
            : phase === "error"
              ? "Couldn’t measure — you’re still on your plan speed."
              : planMbps
                ? `Measured vs plan up to ~${formatMbps(planMbps)} Mbps.`
                : "Measured download on this Wi‑Fi."}
        </p>
        {phase !== "testing" ? (
          <button
            type="button"
            className="shrink-0 text-[10px] font-semibold text-land-yellow underline underline-offset-2"
            onClick={() => setRunId((n) => n + 1)}
          >
            Test again
          </button>
        ) : null}
      </div>
    </div>
  );
}
