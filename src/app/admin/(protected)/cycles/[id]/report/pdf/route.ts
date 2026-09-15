import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/require-admin-user";
import { buildIndividualReportData } from "@/lib/report/build-individual-report-data";
import { NotAuthenticatedError, renderUrlToPdf } from "@/lib/report/render-pdf";

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
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    // Anything else (a Chromium launch failure, a navigation timeout, etc.)
    // is a genuine bug, not a stale session -- log it for Vercel's function
    // logs and say so plainly, rather than silently bouncing to login and
    // leaving it looking like nothing happened.
    console.error("PDF export failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`PDF export failed: ${message}`, { status: 500 });
  }

  const filename = `${data.leaderName.replace(/[^a-z0-9]+/gi, "-")}-360-report.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
