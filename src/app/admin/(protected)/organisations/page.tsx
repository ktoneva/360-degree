import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewOrganisationForm } from "./new-organisation-form";

export const dynamic = "force-dynamic";

export default async function OrganisationsPage() {
  const supabase = createAdminClient();
  const { data: organisations, error } = await supabase
    .from("organisations")
    .select("id, name, contact_name, contact_email")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to review cycles
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-zinc-900">Organisations</h1>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Add an organisation</h2>
        <NewOrganisationForm />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load organisations: {error.message}
        </p>
      )}

      {!error && (!organisations || organisations.length === 0) && (
        <p className="text-sm text-zinc-500">No organisations yet.</p>
      )}

      {!error && organisations && organisations.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {organisations.map((org) => (
            <li key={org.id}>
              <Link
                href={`/admin/organisations/${org.id}/report`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50"
              >
                <div>
                  <p className="font-medium text-zinc-900">{org.name}</p>
                  {(org.contact_name || org.contact_email) && (
                    <p className="text-sm text-zinc-500">
                      {[org.contact_name, org.contact_email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm text-zinc-500">View report &rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
