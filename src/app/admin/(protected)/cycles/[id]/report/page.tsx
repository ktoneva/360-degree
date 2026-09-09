import Link from "next/link";
import { notFound } from "next/navigation";
import { buildIndividualReportData } from "@/lib/report/build-individual-report-data";
import { ReportView } from "./report-view";
import { PrintButton } from "./print-button";

// Explicit, since Supabase-js calls aren't native fetch() and Next's static
// analysis can't otherwise tell this page depends on live data.
export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await buildIndividualReportData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="print:m-0">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 print:hidden">
        <Link href={`/admin/cycles/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to cycle
        </Link>
        <PrintButton />
      </div>

      <ReportView data={data} />
    </div>
  );
}
