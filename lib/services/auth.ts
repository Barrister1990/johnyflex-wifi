import {
  ensureProfileForAuthUser,
  profileToPublic,
  updateProfile,
} from "@/lib/repositories/profiles";
import { clearSessionCookie } from "@/lib/auth/session";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublicUser } from "@/lib/types";
import { loginSchema } from "@/lib/validations";

function requireConfigured() {
  requireSupabaseEnv();
}

export async function login(raw: unknown): Promise<PublicUser> {
  requireConfigured();
  const data = loginSchema.parse(raw);
  const supabase = await createServerSupabaseClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (error) throw new Error("Invalid email or password");
  if (!authData.user?.email) {
    throw new Error("Invalid email or password");
  }

  const profile = await ensureProfileForAuthUser({
    id: authData.user.id,
    email: authData.user.email,
    name:
      typeof authData.user.user_metadata?.name === "string"
        ? authData.user.user_metadata.name
        : null,
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("profiles")) {
      throw new Error(
        "Supabase profiles table missing. Run supabase/migrations/001_admin_profiles.sql first.",
      );
    }
    throw err;
  });

  return profileToPublic(profile);
}

export async function logout(): Promise<void> {
  requireConfigured();
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  await clearSessionCookie();
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  requireConfigured();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const profile = await ensureProfileForAuthUser({
    id: user.id,
    email: user.email,
    name:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null,
  });

  return profileToPublic(profile);
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function updateCurrentUserProfile(
  patch: Parameters<typeof updateProfile>[1],
): Promise<PublicUser> {
  const user = await requireUser();
  const updated = await updateProfile(user.id, patch);
  if (!updated) throw new Error("Profile not found");
  return profileToPublic(updated);
}

export function authMode(): "supabase" {
  return "supabase";
}
