import { createClient } from "./server";

/**
 * Defense-in-depth check inside every admin server action, independent of
 * the middleware redirect — a server action is its own POST endpoint, and
 * this must never rely solely on the page-level gate holding up.
 */
export async function requireAdminUser(): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You need to sign in to do that." };
    return { error: null };
  } catch {
    return { error: "You need to sign in to do that." };
  }
}
