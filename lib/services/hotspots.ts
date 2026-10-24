import QRCode from "qrcode";
import * as hotspotRepo from "@/lib/repositories/hotspots";
import * as routerRepo from "@/lib/repositories/routers";
import { getCatalogItem } from "@/lib/routers/catalog";
import { requireUser } from "@/lib/services/auth";
import type { Hotspot, HotspotWithRouter } from "@/lib/types";
import { hotspotSchema, hotspotUpdateSchema } from "@/lib/validations";

export async function listHotspots(): Promise<HotspotWithRouter[]> {
  const user = await requireUser();
  return hotspotRepo.listHotspotsByOwner(user.id);
}

export async function createHotspot(raw: unknown): Promise<HotspotWithRouter> {
  const user = await requireUser();
  const data = hotspotSchema.parse(raw);

  let routerId = data.routerId ?? null;

  // Inline catalog attach: create router from catalog then link
  if (!routerId && data.equipmentCatalogId) {
    const catalog = getCatalogItem(data.equipmentCatalogId);
    if (!catalog) throw new Error("Equipment not found in catalog");

    const router = await routerRepo.createRouter({
      ownerId: user.id,
      catalogId: catalog.id,
      vendor: catalog.vendor,
      model: catalog.model,
      adapterType: catalog.adapterType,
      label:
        data.equipmentLabel?.trim() ||
        `${catalog.vendor} ${catalog.model}`,
      host: data.equipmentHost ?? null,
      port: data.equipmentPort ?? catalog.defaultPort,
      username: data.equipmentUsername ?? null,
      password: data.equipmentPassword ?? null,
      connectionStatus:
        catalog.adapterType === "mock"
          ? "mock"
          : data.equipmentHost
            ? "pending"
            : "unconfigured",
      notes: data.equipmentNotes ?? null,
    });
    routerId = router.id;
  }

  const hotspot = await hotspotRepo.createHotspot(user.id, {
    name: data.name,
    ssid: data.ssid,
    address: data.address,
    status: data.status ?? "active",
    routerId,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
  });

  const withRouter = await hotspotRepo.getHotspotWithRouter(
    hotspot.id,
    user.id,
  );
  return withRouter!;
}

export async function updateHotspot(
  id: string,
  raw: unknown,
): Promise<HotspotWithRouter> {
  const user = await requireUser();
  const data = hotspotUpdateSchema.parse(raw);

  let routerId = data.routerId;

  if (data.equipmentCatalogId) {
    const catalog = getCatalogItem(data.equipmentCatalogId);
    if (!catalog) throw new Error("Equipment not found in catalog");

    const existing = await hotspotRepo.getHotspotById(id, user.id);
    if (!existing) throw new Error("Hotspot not found");

    if (existing.routerId) {
      await routerRepo.updateRouter(existing.routerId, user.id, {
        catalogId: catalog.id,
        vendor: catalog.vendor,
        model: catalog.model,
        adapterType: catalog.adapterType,
        label:
          data.equipmentLabel?.trim() ||
          `${catalog.vendor} ${catalog.model}`,
        host: data.equipmentHost ?? undefined,
        port: data.equipmentPort ?? catalog.defaultPort ?? undefined,
        username: data.equipmentUsername ?? undefined,
        passwordStored: data.equipmentPassword ?? undefined,
        notes: data.equipmentNotes ?? undefined,
        connectionStatus:
          catalog.adapterType === "mock"
            ? "mock"
            : data.equipmentHost
              ? "pending"
              : "unconfigured",
      });
      routerId = existing.routerId;
    } else {
      const router = await routerRepo.createRouter({
        ownerId: user.id,
        hotspotId: id,
        catalogId: catalog.id,
        vendor: catalog.vendor,
        model: catalog.model,
        adapterType: catalog.adapterType,
        label:
          data.equipmentLabel?.trim() ||
          `${catalog.vendor} ${catalog.model}`,
        host: data.equipmentHost ?? null,
        port: data.equipmentPort ?? catalog.defaultPort,
        username: data.equipmentUsername ?? null,
        password: data.equipmentPassword ?? null,
        connectionStatus:
          catalog.adapterType === "mock"
            ? "mock"
            : data.equipmentHost
              ? "pending"
              : "unconfigured",
        notes: data.equipmentNotes ?? null,
      });
      routerId = router.id;
    }
  }

  const updated = await hotspotRepo.updateHotspot(id, user.id, {
    name: data.name,
    ssid: data.ssid,
    address: data.address,
    status: data.status,
    routerId,
    latitude: data.latitude,
    longitude: data.longitude,
  });
  if (!updated) throw new Error("Hotspot not found");

  const withRouter = await hotspotRepo.getHotspotWithRouter(id, user.id);
  return withRouter!;
}

export async function deleteHotspot(id: string): Promise<void> {
  const user = await requireUser();
  const ok = await hotspotRepo.deleteHotspot(id, user.id);
  if (!ok) throw new Error("Hotspot not found");
}

export async function getHotspotQrDataUrl(
  id: string,
  origin: string,
): Promise<{ dataUrl: string; url: string }> {
  const user = await requireUser();
  const hotspot = await hotspotRepo.getHotspotById(id, user.id);
  if (!hotspot) throw new Error("Hotspot not found");

  const url = `${origin}${hotspot.qrPayload}`;
  const dataUrl = await QRCode.toDataURL(url, {
    margin: 2,
    width: 320,
    color: { dark: "#0F1115", light: "#FFFFFF" },
  });

  return { dataUrl, url };
}

export async function getPublicHotspot(id: string): Promise<Hotspot | null> {
  return hotspotRepo.getHotspotById(id);
}
