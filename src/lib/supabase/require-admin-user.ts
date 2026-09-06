import { createClient } from "./server";

/**
 * Auth check inside every admin server action. A Server Action is its own
 * POST endpoint, invoked directly by the client — it is not protected by
 * the (protected) layout's render-time redirect, so it needs this check
 * independently rather than assuming the page around it was gated.
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
