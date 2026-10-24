/** Operator multi-location filter. `"all"` = every hotspot (compat default). */

export const LOCATION_COOKIE = "wifihub_location";
export const LOCATION_STORAGE_KEY = "wifihub_location";
export const LOCATION_ALL = "all";

export type LocationFilterId = typeof LOCATION_ALL | string;

export function normalizeLocationId(
  raw: string | null | undefined,
): LocationFilterId {
  if (!raw || raw === LOCATION_ALL) return LOCATION_ALL;
  return raw.trim();
}

export function isAllLocations(id: LocationFilterId): boolean {
  return id === LOCATION_ALL;
}

/** Narrow owner hotspot ids by filter; invalid uuid falls back to all. */
export function filterHotspotIds(
  ownerHotspotIds: string[],
  locationId: LocationFilterId,
): string[] {
  if (isAllLocations(locationId)) return ownerHotspotIds;
  if (ownerHotspotIds.includes(locationId)) return [locationId];
  return ownerHotspotIds;
}

export function locationLabel(
  locationId: LocationFilterId,
  hotspots: { id: string; name: string }[],
): string {
  if (isAllLocations(locationId)) return "All locations";
  return hotspots.find((h) => h.id === locationId)?.name ?? "All locations";
}
