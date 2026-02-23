/**
 * In-memory sliding-window rate limiter scoped to individual account IDs.
 *
 * Limits: 10 transfer attempts per account per 60-second window.
 * This guards against burst-transfer abuse that a global IP limiter would miss
 * (e.g. an attacker using many IPs to drain a single compromised account).
 *
 * Implementation uses a Map<accountId, timestamp[]> cleaned up on each check;
 * suitable for single-process deployments. In a multi-process or distributed
 * deployment, replace with a Redis ZRANGEBYSCORE + ZADD approach.
 */

const WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_PER_WINDOW = 10;

/** accountId → timestamps of recent transfer attempts */
const transferWindows = new Map<string, number[]>();

/**
 * Record a transfer attempt for `accountId` and check if the account has
 * exceeded the per-minute limit.
 *
 * @returns `true` when the request is within the limit (allowed).
 *          `false` when the limit has been exceeded (block the request).
 */
export function checkAccountTransferLimit(accountId: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get existing window, prune entries older than the window start.
  const timestamps = (transferWindows.get(accountId) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_PER_WINDOW) {
    // Store the pruned list so the next check is cheaper, but do NOT record
    // this rejected attempt as a used slot. Rejected requests should not
    // consume quota — only successfully initiated transfers count toward the
    // limit, so a user can retry after a transient error without burning slots.
    transferWindows.set(accountId, timestamps);
    return false;
  }

  timestamps.push(now);
  transferWindows.set(accountId, timestamps);
  return true;
}

/** Exposed for testing: clear all rate-limit state. */
export function resetAccountLimits(): void {
  transferWindows.clear();
}

/** How many attempts remain in the current window for `accountId`. */
export function remainingAttempts(accountId: string): number {
  const now = Date.now();
  const timestamps = (transferWindows.get(accountId) ?? []).filter((t) => t > now - WINDOW_MS);
  return Math.max(0, MAX_PER_WINDOW - timestamps.length);
}
