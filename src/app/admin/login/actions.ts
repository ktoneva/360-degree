"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LoginState } from "@/lib/login-state";

function isSafeRedirectPath(path: string | null): path is string {
  return !!path && path.startsWith("/admin") && !path.startsWith("//") && !path.includes("://");
}

export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectPath = String(formData.get("redirect") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  let destination = "/admin";

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "Incorrect email or password." };
    }
    if (isSafeRedirectPath(redirectPath)) {
      destination = redirectPath;
    }
  } catch {
    return { error: "Something went wrong signing in. Please try again." };
  }

  redirect(destination);
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Fall through to the redirect regardless — worst case the session
    // cookie is still present and middleware will re-check it next request.
  }
  redirect("/admin/login");
}
