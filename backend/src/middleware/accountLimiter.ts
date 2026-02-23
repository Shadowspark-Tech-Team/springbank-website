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

/**
 * Velocity alerting: if an account executes this many transfers within the
 * alert window, a structured warning is emitted even though the requests
 * are still allowed (the rate-limit check is separate).
 */
const VELOCITY_ALERT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const VELOCITY_ALERT_THRESHOLD = 6;

/** Tracks the most recent alert emission timestamp per account to prevent log flooding. */
const lastAlertTime = new Map<string, number>();

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

/** How many attempts remain in the current window for `accountId`. */
export function remainingAttempts(accountId: string): number {
  const now = Date.now();
  const timestamps = (transferWindows.get(accountId) ?? []).filter((t) => t > now - WINDOW_MS);
  return Math.max(0, MAX_PER_WINDOW - timestamps.length);
}

/**
 * Check whether an account's recent transfer volume exceeds the velocity
 * alert threshold (6 transfers in 5 minutes).
 *
 * Call this **after** `checkAccountTransferLimit` has already recorded the
 * current attempt so the timestamp is included in the count.
 *
 * Returns `true` only on the **first** time the threshold is crossed in a
 * given window, then suppresses further alerts until the window resets.
 * This prevents log flooding and duplicate audit entries.
 *
 * @returns `true` when a new alert should be emitted (caller should emit a
 *          warning log and an audit-log entry).  Does not block the request.
 */
export function checkVelocityAlert(accountId: string): boolean {
  const now = Date.now();
  const alertWindowStart = now - VELOCITY_ALERT_WINDOW_MS;
  const recentCount = (transferWindows.get(accountId) ?? []).filter((t) => t > alertWindowStart).length;

  if (recentCount < VELOCITY_ALERT_THRESHOLD) return false;

  // Only emit the alert once per alert window to prevent flooding.
  const lastAlert = lastAlertTime.get(accountId) ?? 0;
  if (now - lastAlert < VELOCITY_ALERT_WINDOW_MS) return false;

  lastAlertTime.set(accountId, now);
  return true;
}

/** Exposed for testing: clear all rate-limit and alert state. */
export function resetAccountLimits(): void {
  transferWindows.clear();
  lastAlertTime.clear();
}
