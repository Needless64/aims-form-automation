export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Simple per-key fixed-window limiter. Suitable for a single Node instance.
 * A multi-instance deployment should use a shared store (see README).
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let lastSweep = now();

  return function check(key: string): RateLimitResult {
    const current = now();

    if (current - lastSweep > windowMs) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= current) buckets.delete(bucketKey);
      }
      lastSweep = current;
    }

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= current) {
      buckets.set(key, { count: 1, resetAt: current + windowMs });
      return {
        allowed: true,
        remaining: limit - 1,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt - current) / 1000),
        ),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - current) / 1000),
      ),
    };
  };
}

/**
 * Kept on globalThis so hot reloads in development do not reset the limit.
 */
const globalForRateLimit = globalThis as typeof globalThis & {
  __aimsRateLimiter?: ReturnType<typeof createRateLimiter>;
};

export const enquiryRateLimiter =
  globalForRateLimit.__aimsRateLimiter ??
  createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.__aimsRateLimiter = enquiryRateLimiter;
}
