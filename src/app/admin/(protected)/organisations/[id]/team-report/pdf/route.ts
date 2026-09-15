import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/require-admin-user";
import { buildTeamReportData } from "@/lib/report/build-team-report-data";
import { renderUrlToPdf } from "@/lib/report/render-pdf";
import { LEADER_LEVELS, type LeaderLevel } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isLeaderLevel(value: string): value is LeaderLevel {
  return (LEADER_LEVELS as string[]).includes(value);
}

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
  const levelParam = new URL(request.url).searchParams.get("level");
  if (!levelParam || !isLeaderLevel(levelParam)) {
    return new NextResponse("Missing or invalid level", { status: 400 });
  }

  const data = await buildTeamReportData(id, levelParam);
  if (!data || data.leaders.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const targetUrl = new URL(`/admin/organisations/${id}/team-report?level=${levelParam}`, request.url).toString();
  let pdf: Buffer;
  try {
    pdf = await renderUrlToPdf(targetUrl, request.headers.get("cookie"));
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const filenameBase = `${data.organisationName}-${data.levelLabel}-team-report`.replace(/[^a-z0-9]+/gi, "-");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
