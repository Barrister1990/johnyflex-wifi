import {
  ensureProfileForAuthUser,
  getProfileById,
  profileToPublic,
  updateProfile,
  type ProfileRow,
} from "@/lib/repositories/profiles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublicUser, User } from "@/lib/types";

function profileToUser(row: ProfileRow): User {
  return {
    ...profileToPublic(row),
    passwordHash: "",
  };
}

/** Maps a profile (or User) to the public operator shape. */
export function toPublic(user: User | PublicUser | ProfileRow): PublicUser {
  if ("passwordHash" in user) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
  if ("business_name" in user) {
    return profileToPublic(user);
  }
  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  const profile = await getProfileById(id);
  return profile ? profileToUser(profile) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? profileToUser(data as ProfileRow) : null;
}

export async function updateUserProfile(
  id: string,
  patch: Partial<
    Pick<
      User,
      | "name"
      | "businessName"
      | "phone"
      | "supportEmail"
      | "currency"
      | "timezone"
      | "notifyPaymentSuccess"
      | "notifySessionExpired"
      | "notifySystem"
      | "freeModeEnabled"
      | "freeModeStartsAt"
      | "freeModeEndsAt"
      | "freeModePackageId"
    >
  >,
): Promise<PublicUser | null> {
  const updated = await updateProfile(id, patch);
  return updated ? profileToPublic(updated) : null;
}

/**
 * Change password via Supabase Auth (verifies current password first).
 */
export async function changeUserPassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await findUserById(id);
  if (!user) return false;

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return false;

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return true;
}

export { ensureProfileForAuthUser, profileToPublic };
