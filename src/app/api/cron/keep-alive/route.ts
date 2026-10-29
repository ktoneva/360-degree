import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Supabase's free tier auto-pauses a project that doesn't get "a few user
 * requests to the database each day". A single trivial query a day proved too
 * little (Supabase still sent pause warnings), so each invocation here issues
 * several real queries across the main tables, and vercel.json calls this
 * three times a day (Hobby crons are limited to once per day per entry).
 *
 * Guarded by CRON_SECRET (Vercel sends it as a Bearer token on cron requests);
 * fails closed with 401 if unset or mismatched.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const tables = ["organisations", "review_cycles", "raters", "responses", "items", "competencies"];

  const results = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
      return { table, count, error: error?.message ?? null };
    }),
  );

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    return new NextResponse(`Keep-alive queries failed: ${failed.map((f) => `${f.table}: ${f.error}`).join("; ")}`, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), queries: results.length });
}
