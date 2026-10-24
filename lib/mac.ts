/** Normalize MAC to lowercase colon-separated hex (aa:bb:cc:dd:ee:ff). */
export function normalizeMac(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hex = raw.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}

/** WiFiHub synthetic / placeholder MACs that cannot unlock a real station. */
export function isUsableClientMac(mac: string | null | undefined): boolean {
  const n = normalizeMac(mac);
  if (!n) return false;
  if (n === "00:00:00:00:00:00" || n === "ff:ff:ff:ff:ff:ff") return false;
  // Locally administered synthetic prefix used by findOrCreateDevice fallback
  if (n.startsWith("02:wh:")) return false;
  return true;
}

/**
 * MikroTik captive portal typically appends mac / mac-address / client-mac.
 * Also accepts dashed or dotted forms.
 */
export function extractClientMac(
  source:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | null
    | undefined,
): string | null {
  if (!source) return null;

  const get = (key: string): string | undefined => {
    if (source instanceof URLSearchParams) {
      return source.get(key) ?? undefined;
    }
    const v = source[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  for (const key of [
    "mac",
    "mac-address",
    "mac_address",
    "client-mac",
    "client_mac",
    "clientmac",
  ]) {
    const n = normalizeMac(get(key));
    if (n && isUsableClientMac(n)) return n;
  }
  return null;
}
