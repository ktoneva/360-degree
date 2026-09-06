import Link from "next/link";
import { notFound } from "next/navigation";
import { buildReportData } from "@/lib/report/build-report-data";
import { ReportView } from "./report-view";
import { PrintButton } from "./print-button";

// Explicit, since Supabase-js calls aren't native fetch() and Next's static
// analysis can't otherwise tell this page depends on live data.
export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await buildReportData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/admin/cycles/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to cycle
        </Link>
        <PrintButton />
      </div>

      <h1 className="text-2xl font-semibold text-zinc-900 print:text-xl">
        360&deg; feedback report
      </h1>

      <ReportView data={data} />
    </div>
  );
}
