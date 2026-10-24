"use client";

import { useEffect, useState } from "react";

export function SessionCountdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Expired");
        return;
      }
      const totalSec = Math.floor(ms / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (d > 0) setLabel(`${d}d ${h}h ${m}m left`);
      else if (h > 0) setLabel(`${h}h ${m}m ${s}s left`);
      else setLabel(`${m}m ${s}s left`);
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return (
    <p className="font-display text-[1.35rem] leading-tight tracking-tight text-primary">
      {label || "…"}
    </p>
  );
}
