import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  requireSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

/** Service-role client — bypasses RLS. Use for portal writes and webhooks. */
export function createServiceSupabaseClient() {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL.",
    );
  }
  const serviceRoleKey = requireSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
