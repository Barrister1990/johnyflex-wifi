import { cookies } from "next/headers";
import {
  LOCATION_ALL,
  LOCATION_COOKIE,
  filterHotspotIds,
  normalizeLocationId,
  type LocationFilterId,
} from "@/lib/location-filter";

export async function getServerLocationId(): Promise<LocationFilterId> {
  const jar = await cookies();
  return normalizeLocationId(jar.get(LOCATION_COOKIE)?.value);
}

export async function resolveOwnerHotspotIds(
  ownerHotspotIds: string[],
): Promise<{ locationId: LocationFilterId; hotspotIds: string[] }> {
  const locationId = await getServerLocationId();
  return {
    locationId,
    hotspotIds: filterHotspotIds(ownerHotspotIds, locationId),
  };
}

export { LOCATION_ALL };
