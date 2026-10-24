"use client";

import { useLocationFilter } from "@/components/location-provider";
import { LOCATION_ALL } from "@/lib/location-filter";

type Props = {
  collapsed?: boolean;
  className?: string;
};

export function LocationSwitcher({ collapsed = false, className = "" }: Props) {
  const { locationId, setLocationId, hotspots, ready } = useLocationFilter();

  if (!ready) {
    return (
      <div
        className={`h-9 animate-pulse rounded-xl bg-inset ${collapsed ? "w-9" : "w-full"} ${className}`}
      />
    );
  }

  if (collapsed) {
    return (
      <select
        aria-label="Location"
        title="Location"
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className={`h-9 w-9 cursor-pointer appearance-none rounded-xl border border-border bg-canvas text-center text-[10px] font-semibold text-primary ${className}`}
      >
        <option value={LOCATION_ALL}>All</option>
        {hotspots.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name.slice(0, 3)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <label className={`flex w-full flex-col gap-1 ${className}`}>
      <span className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
        Location
      </span>
      <select
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className="h-9 w-full rounded-xl border border-border bg-canvas px-2.5 text-xs-tight font-medium text-primary outline-none focus:border-primary md:text-sm"
      >
        <option value={LOCATION_ALL}>All locations</option>
        {hotspots.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
            {h.status !== "active" ? ` (${h.status})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
