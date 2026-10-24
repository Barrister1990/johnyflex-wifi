"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  LOCATION_ALL,
  LOCATION_COOKIE,
  LOCATION_STORAGE_KEY,
  normalizeLocationId,
  type LocationFilterId,
} from "@/lib/location-filter";

export type LocationOption = { id: string; name: string; status: string };

type LocationContextValue = {
  locationId: LocationFilterId;
  setLocationId: (id: LocationFilterId) => void;
  hotspots: LocationOption[];
  ready: boolean;
};

const LocationContext = createContext<LocationContextValue | null>(null);

function writeCookie(id: LocationFilterId) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCATION_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; samesite=lax`;
}

type Props = {
  children: ReactNode;
  hotspots: LocationOption[];
  initialLocationId?: LocationFilterId;
};

export function LocationProvider({
  children,
  hotspots,
  initialLocationId = LOCATION_ALL,
}: Props) {
  const router = useRouter();
  const [locationId, setLocationIdState] = useState<LocationFilterId>(
    normalizeLocationId(initialLocationId),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    const next = normalizeLocationId(stored || initialLocationId);
    const valid =
      next === LOCATION_ALL || hotspots.some((h) => h.id === next)
        ? next
        : LOCATION_ALL;
    setLocationIdState(valid);
    writeCookie(valid);
    localStorage.setItem(LOCATION_STORAGE_KEY, valid);
    setReady(true);
  }, [hotspots, initialLocationId]);

  const setLocationId = useCallback(
    (id: LocationFilterId) => {
      const valid =
        id === LOCATION_ALL || hotspots.some((h) => h.id === id)
          ? id
          : LOCATION_ALL;
      setLocationIdState(valid);
      writeCookie(valid);
      localStorage.setItem(LOCATION_STORAGE_KEY, valid);
      router.refresh();
    },
    [hotspots, router],
  );

  const value = useMemo(
    () => ({ locationId, setLocationId, hotspots, ready }),
    [locationId, setLocationId, hotspots, ready],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useLocationFilter() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocationFilter must be used within LocationProvider");
  }
  return ctx;
}
