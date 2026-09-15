import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/require-admin-user";
import { buildIndividualReportData } from "@/lib/report/build-individual-report-data";
import { renderUrlToPdf } from "@/lib/report/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A route handler is its own endpoint -- it is NOT wrapped by the
 * (protected) layout's render-time redirect, since layouts only wrap page
 * rendering, never sibling route handlers. Needs the same auth check the
 * layout does, independently, same principle as every server action here.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminUser();
  if (error) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { id } = await params;
  const data = await buildIndividualReportData(id);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const targetUrl = new URL(`/admin/cycles/${id}/report`, request.url).toString();
  let pdf: Buffer;
  try {
    pdf = await renderUrlToPdf(targetUrl, request.headers.get("cookie"));
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const filename = `${data.leaderName.replace(/[^a-z0-9]+/gi, "-")}-360-report.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
