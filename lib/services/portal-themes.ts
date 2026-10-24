import * as themeRepo from "@/lib/repositories/portal-themes";
import { requireUser } from "@/lib/services/auth";
import { portalThemeSchema } from "@/lib/validations";

export async function getOwnerPortalThemes() {
  const user = await requireUser();
  const themes = await themeRepo.listThemesByOwner(user.id);
  return { themes, defaults: themeRepo.DEFAULT_PORTAL_THEME };
}

export async function saveOwnerPortalTheme(raw: unknown) {
  const user = await requireUser();
  const data = portalThemeSchema.parse(raw);
  return themeRepo.upsertTheme({
    ownerId: user.id,
    hotspotId: data.hotspotId ?? null,
    logoUrl: data.logoUrl ?? null,
    primaryColor: data.primaryColor,
    accentColor: data.accentColor,
    welcomeMessage: data.welcomeMessage,
    backgroundImageUrl: data.backgroundImageUrl ?? null,
    termsText: data.termsText,
    showPackages: data.showPackages,
    showVoucherRedeem: data.showVoucherRedeem,
  });
}

export async function resolvePortalTheme(ownerId: string, hotspotId: string) {
  return themeRepo.getThemeForHotspot(ownerId, hotspotId);
}
