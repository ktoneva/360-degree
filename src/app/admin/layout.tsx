import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      {user && (
        <div className="flex items-center justify-end gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-2 text-xs text-zinc-500 print:hidden">
          <span>Signed in as {user.email}</span>
          <form action={signOut}>
            <button type="submit" className="font-medium text-zinc-700 hover:text-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      )}
      {children}
    </div>
  );
}
