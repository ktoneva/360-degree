import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel's edge network sets x-forwarded-for itself, so a client can't spoof
// it to dodge the limit -- only the first (client-facing) hop matters.
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headersList.get("x-real-ip") ?? "unknown";
}

/**
 * Atomic, Postgres-backed fixed-window rate limit (see
 * check_respond_rate_limit in the migrations) -- needed because Vercel's
 * serverless functions share no in-memory state across invocations, so a
 * plain in-process counter would not actually limit anything.
 */
export async function checkRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("check_respond_rate_limit", {
      p_key: bucketKey,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    // Fail open: an outage in the rate limiter itself must not lock every
    // rater out of the questionnaire.
    if (error) return true;
    return data as boolean;
  } catch {
    return true;
  }
}
