import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

// Without this, Next prerenders this page once at build time — Supabase-js
// calls aren't native fetch(), so Next's static analysis doesn't detect the
// dynamic data and would otherwise freeze this list at whatever existed when
// the app was last deployed.
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = createAdminClient();

  const { data: cycles, error } = await supabase
    .from("review_cycles")
    .select(
      "id, name, period_start, period_end, review_subjects(full_name, role_title), raters(completed_at)",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Review cycles</h1>
        <Link
          href="/admin/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New review cycle
        </Link>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load review cycles: {error.message}
        </p>
      )}

      {!error && (!cycles || cycles.length === 0) && (
        <p className="text-sm text-zinc-500">
          No review cycles yet. Create one to start inviting raters.
        </p>
      )}

      {!error && cycles && cycles.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {cycles.map((cycle) => {
            const subject = Array.isArray(cycle.review_subjects)
              ? cycle.review_subjects[0]
              : cycle.review_subjects;
            const raters = cycle.raters as { completed_at: string | null }[];
            const invited = raters.length;
            const completed = raters.filter((r) => r.completed_at !== null).length;
            const noRatersYet = invited === 0;
            const fullyComplete = invited > 0 && completed === invited;

            return (
              <li key={cycle.id}>
                <Link
                  href={`/admin/cycles/${cycle.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {subject?.full_name ?? "Unknown leader"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {cycle.name} &middot; {cycle.period_start} to {cycle.period_end}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      noRatersYet
                        ? "bg-zinc-100 text-zinc-500"
                        : fullyComplete
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {noRatersYet ? "No raters yet" : `${completed}/${invited} responded`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
