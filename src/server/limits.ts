import type { NextRequest } from "next/server";

/** Best-effort, per-process rate limits for sign-in, reset and public form requests. */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Counts one event for `key` inside a sliding window; true once `max` is exceeded. */
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return 1 > max;
  }
  bucket.count += 1;
  return bucket.count > max;
}

/** True when `key` has already used up its allowance (does not count). */
export function isBlocked(key: string, max: number): boolean {
  const bucket = buckets.get(key);
  return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= max);
}

export function clearLimit(key: string): void {
  buckets.delete(key);
}

export function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
