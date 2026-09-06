import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only code: admin pages/actions, and the
 * token-gated rater flow (which has no Supabase Auth session of its own —
 * the token itself is the access control, checked in application code).
 * Bypasses RLS. Never import into client components or expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
