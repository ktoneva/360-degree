import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

/**
 * Every admin page except /admin/login sits under this route group, so this
 * is the single place that actually enforces "must be signed in". This is
 * deliberately a Server Component check, not a middleware/proxy redirect —
 * verified locally and on a live Vercel preview that the proxy convention in
 * this Next.js version does not reliably run for every request, so
 * authorization must not depend on it. This matches Next's own guidance:
 * verify auth inside the thing that renders/mutates, not only in Proxy.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-2 text-xs text-zinc-500 print:hidden">
        <span>Signed in as {user.email}</span>
        <form action={signOut}>
          <button type="submit" className="font-medium text-zinc-700 hover:text-zinc-900">
            Sign out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
