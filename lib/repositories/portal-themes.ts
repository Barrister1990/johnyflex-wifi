import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PortalTheme } from "@/lib/types";

type ThemeRow = {
  id: string;
  owner_id: string;
  hotspot_id: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  welcome_message: string;
  background_image_url: string | null;
  terms_text: string;
  show_packages: boolean;
  show_voucher_redeem: boolean;
  created_at: string;
  updated_at: string;
};

function mapTheme(row: ThemeRow): PortalTheme {
  return {
    id: row.id,
    ownerId: row.owner_id,
    hotspotId: row.hotspot_id,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    welcomeMessage: row.welcome_message,
    backgroundImageUrl: row.background_image_url,
    termsText: row.terms_text,
    showPackages: row.show_packages,
    showVoucherRedeem: row.show_voucher_redeem,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const DEFAULT_PORTAL_THEME: Omit<
  PortalTheme,
  "id" | "ownerId" | "hotspotId" | "createdAt" | "updatedAt"
> = {
  logoUrl: null,
  primaryColor: "#041a12",
  accentColor: "#c8f542",
  welcomeMessage: "Buy Wi‑Fi access and get online in seconds.",
  backgroundImageUrl: null,
  termsText:
    "By purchasing access you agree to fair-use of this network. Illegal activity is prohibited. Unused time is non-refundable.",
  showPackages: true,
  showVoucherRedeem: true,
};

export async function listThemesByOwner(ownerId: string): Promise<PortalTheme[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("portal_themes")
    .select("*")
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  return ((data as ThemeRow[]) ?? []).map(mapTheme);
}

export async function getThemeForHotspot(
  ownerId: string,
  hotspotId: string,
): Promise<PortalTheme> {
  // Public portal may call without owner session — use service or anon read policy
  const { createServiceSupabaseClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceSupabaseClient();

  const { data: specific, error: specificError } = await supabase
    .from("portal_themes")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("hotspot_id", hotspotId)
    .maybeSingle();
  if (specificError) throw new Error(specificError.message);
  if (specific) return mapTheme(specific as ThemeRow);

  const { data: ownerDefault, error: defaultError } = await supabase
    .from("portal_themes")
    .select("*")
    .eq("owner_id", ownerId)
    .is("hotspot_id", null)
    .maybeSingle();
  if (defaultError) throw new Error(defaultError.message);
  if (ownerDefault) return mapTheme(ownerDefault as ThemeRow);

  const createdAt = new Date().toISOString();
  return {
    id: "virtual-default",
    ownerId,
    hotspotId: null,
    ...DEFAULT_PORTAL_THEME,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function upsertTheme(input: {
  ownerId: string;
  hotspotId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
  backgroundImageUrl: string | null;
  termsText: string;
  showPackages: boolean;
  showVoucherRedeem: boolean;
}): Promise<PortalTheme> {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  let existingQuery = supabase
    .from("portal_themes")
    .select("*")
    .eq("owner_id", input.ownerId);
  existingQuery =
    input.hotspotId == null
      ? existingQuery.is("hotspot_id", null)
      : existingQuery.eq("hotspot_id", input.hotspotId);

  const { data: existing, error: findError } = await existingQuery.maybeSingle();
  if (findError) throw new Error(findError.message);

  const payload = {
    logo_url: input.logoUrl,
    primary_color: input.primaryColor,
    accent_color: input.accentColor,
    welcome_message: input.welcomeMessage,
    background_image_url: input.backgroundImageUrl,
    terms_text: input.termsText,
    show_packages: input.showPackages,
    show_voucher_redeem: input.showVoucherRedeem,
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("portal_themes")
      .update(payload)
      .eq("id", (existing as ThemeRow).id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapTheme(data as ThemeRow);
  }

  const { data, error } = await supabase
    .from("portal_themes")
    .insert({
      owner_id: input.ownerId,
      hotspot_id: input.hotspotId,
      ...payload,
      created_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTheme(data as ThemeRow);
}
