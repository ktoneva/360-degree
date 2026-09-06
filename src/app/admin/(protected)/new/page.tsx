import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewCycleForm } from "./new-cycle-form";

export const dynamic = "force-dynamic";

export default async function NewCyclePage() {
  const supabase = createAdminClient();
  const { data: organisations } = await supabase
    .from("organisations")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to review cycles
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-zinc-900">New review cycle</h1>
      <NewCycleForm organisations={organisations ?? []} />
    </div>
  );
}
