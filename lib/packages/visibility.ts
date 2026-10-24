export function packageVisibleAtHotspot(
  pkg: { enabled: boolean; hotspotIds: string[] | null },
  hotspotId: string,
): boolean {
  if (!pkg.enabled) return false;
  if (!pkg.hotspotIds || pkg.hotspotIds.length === 0) return true;
  return pkg.hotspotIds.includes(hotspotId);
}
