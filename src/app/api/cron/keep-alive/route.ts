import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Supabase's free tier auto-pauses a project after 7 days with no database
 * activity, which would take this app's database offline until someone
 * manually un-pauses it from the Supabase dashboard. Vercel Cron hits this
 * once a day (see vercel.json) so the project never goes quiet long enough
 * to be flagged, without needing to upgrade to a paid Supabase plan.
 *
 * Guarded by CRON_SECRET so it can't be triggered by arbitrary traffic --
 * once that env var is set in the Vercel project, Vercel automatically sends
 * it as a Bearer token on every cron-triggered request to this path. Fails
 * closed (401) if the secret isn't configured or doesn't match, rather than
 * running an unauthenticated query for anyone who finds the URL.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("organisations").select("id").limit(1);
  if (error) {
    return new NextResponse(`Keep-alive query failed: ${error.message}`, { status: 500 });
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
