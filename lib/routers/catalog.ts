import type { RouterAdapterType, RouterCatalogItem } from "@/lib/types";

/**
 * Enterprise equipment catalog — searchable registry of backhaul and
 * access hardware WiFiHub can attach to a hotspot. Adapters for MikroTik
 * etc. land in later phases; Starlink/others remain catalog + mock-ready.
 */
export const ROUTER_CATALOG: RouterCatalogItem[] = [
  {
    id: "starlink-standard",
    vendor: "Starlink",
    model: "Standard Kit",
    category: "backhaul",
    adapterType: "starlink",
    tags: ["satellite", "backhaul", "starlink", "rural"],
    description: "LEO satellite backhaul for remote Ghana sites.",
    defaultPort: null,
    supportsCaptivePortal: false,
    available: true,
  },
  {
    id: "starlink-mini",
    vendor: "Starlink",
    model: "Mini",
    category: "backhaul",
    adapterType: "starlink",
    tags: ["satellite", "portable", "starlink", "mini"],
    description: "Compact Starlink terminal for pop-up venues.",
    defaultPort: null,
    supportsCaptivePortal: false,
    available: true,
  },
  {
    id: "starlink-hp",
    vendor: "Starlink",
    model: "High Performance",
    category: "backhaul",
    adapterType: "starlink",
    tags: ["satellite", "enterprise", "starlink"],
    description: "Higher throughput Starlink for dense campuses.",
    defaultPort: null,
    supportsCaptivePortal: false,
    available: true,
  },
  {
    id: "mikrotik-hap-ax3",
    vendor: "MikroTik",
    model: "hAP ax³",
    category: "access-point",
    adapterType: "mikrotik",
    tags: ["mikrotik", "wifi6", "ap", "captive"],
    description: "Primary MikroTik AP with RouterOS captive portal.",
    defaultPort: 8728,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "mikrotik-hap-ac2",
    vendor: "MikroTik",
    model: "hAP ac²",
    category: "access-point",
    adapterType: "mikrotik",
    tags: ["mikrotik", "wifi5", "ap"],
    description: "Affordable dual-band MikroTik access point.",
    defaultPort: 8728,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "mikrotik-ccr2004",
    vendor: "MikroTik",
    model: "CCR2004",
    category: "gateway",
    adapterType: "mikrotik",
    tags: ["mikrotik", "router", "enterprise", "gateway"],
    description: "Cloud Core Router for multi-site aggregation.",
    defaultPort: 8728,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "unifi-u6-lite",
    vendor: "Ubiquiti",
    model: "UniFi U6 Lite",
    category: "access-point",
    adapterType: "unifi",
    tags: ["unifi", "ubiquiti", "wifi6", "ap"],
    description: "UniFi Wi-Fi 6 AP managed via controller.",
    defaultPort: 443,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "unifi-dream-machine",
    vendor: "Ubiquiti",
    model: "Dream Machine",
    category: "gateway",
    adapterType: "unifi",
    tags: ["unifi", "gateway", "controller"],
    description: "All-in-one UniFi gateway and controller.",
    defaultPort: 443,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "tplink-omada-eap610",
    vendor: "TP-Link",
    model: "Omada EAP610",
    category: "access-point",
    adapterType: "generic",
    tags: ["tplink", "omada", "wifi6", "ap"],
    description: "Omada cloud/controller-managed Wi-Fi 6 AP.",
    defaultPort: 443,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "pfsense-ce",
    vendor: "Netgate",
    model: "pfSense CE",
    category: "gateway",
    adapterType: "pfsense",
    tags: ["pfsense", "firewall", "gateway", "captive"],
    description: "pfSense firewall/router with captive portal.",
    defaultPort: 443,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "opnsense",
    vendor: "Deciso",
    model: "OPNsense",
    category: "gateway",
    adapterType: "pfsense",
    tags: ["opnsense", "firewall", "gateway"],
    description: "OPNsense open-source firewall platform.",
    defaultPort: 443,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "openwrt-generic",
    vendor: "OpenWrt",
    model: "Generic CPE",
    category: "cpe",
    adapterType: "openwrt",
    tags: ["openwrt", "cpe", "linux", "diy"],
    description: "Any OpenWrt-compatible router or CPE.",
    defaultPort: 22,
    supportsCaptivePortal: true,
    available: true,
  },
  {
    id: "generic-ap",
    vendor: "Generic",
    model: "Wi-Fi Access Point",
    category: "access-point",
    adapterType: "generic",
    tags: ["generic", "ap", "wifi"],
    description: "Vendor-agnostic access point (catalog only).",
    defaultPort: null,
    supportsCaptivePortal: false,
    available: true,
  },
  {
    id: "mock-dev",
    vendor: "WiFiHub",
    model: "Mock Router (Development)",
    category: "gateway",
    adapterType: "mock",
    tags: ["mock", "development", "testing"],
    description: "Database-only mock — no hardware required.",
    defaultPort: null,
    supportsCaptivePortal: true,
    available: false,
  },
];

export function searchRouterCatalog(query: string): RouterCatalogItem[] {
  const available = ROUTER_CATALOG.filter((item) => item.available);
  const q = query.trim().toLowerCase();
  if (!q) return available;

  return available.filter((item) => {
    const hay = [
      item.vendor,
      item.model,
      item.category,
      item.adapterType,
      item.description,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((token) => hay.includes(token));
  });
}

export function getCatalogItem(id: string): RouterCatalogItem | null {
  return ROUTER_CATALOG.find((i) => i.id === id) ?? null;
}

export function adapterLabel(type: RouterAdapterType): string {
  const map: Record<RouterAdapterType, string> = {
    mock: "Mock",
    mikrotik: "MikroTik",
    unifi: "UniFi",
    pfsense: "pfSense",
    openwrt: "OpenWrt",
    starlink: "Starlink",
    generic: "Generic",
  };
  return map[type];
}
