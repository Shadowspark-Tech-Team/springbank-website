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

/**
 * Amount-based velocity alert: if the total amount transferred from an account
 * within the alert window exceeds this value (in major currency units), a
 * separate high-amount warning is emitted alongside the count-based alert.
 *
 * Default: $10,000 in 5 minutes — a typical AML soft-trigger threshold.
 */
const VELOCITY_AMOUNT_THRESHOLD = 10_000;

/** Tracks the most recent alert emission timestamp per account to prevent log flooding. */
const lastAlertTime = new Map<string, number>();

/** accountId → timestamps of recent transfer attempts */
const transferWindows = new Map<string, number[]>();

/** accountId → amounts (in major currency units) of recent transfer attempts */
const transferAmounts = new Map<string, { ts: number; amount: number }[]>();

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

/**
 * Record the amount of a committed transfer for velocity-amount tracking.
 *
 * **Ordering**: this must be called *before* `checkVelocityAmountAlert` so
 * that the current transfer's amount is included in the window total when the
 * alert threshold is evaluated.  The typical call sequence is:
 *   1. `checkAccountTransferLimit(id)` — decides whether to allow the request
 *   2. execute the transaction
 *   3. `recordTransferAmount(id, amount)` — record the committed amount
 *   4. `checkVelocityAlert(id)`       — count-based alert check
 *   5. `checkVelocityAmountAlert(id)` — amount-based alert check
 *
 * @param amount - Amount in major currency units (e.g. 50.00 for $50).
 */
export function recordTransferAmount(accountId: string, amount: number): void {
  const now = Date.now();
  const alertWindowStart = now - VELOCITY_ALERT_WINDOW_MS;
  const entries = (transferAmounts.get(accountId) ?? []).filter((e) => e.ts > alertWindowStart);
  entries.push({ ts: now, amount });
  transferAmounts.set(accountId, entries);
}

/** How many attempts remain in the current window for `accountId`. */
export function remainingAttempts(accountId: string): number {
  const now = Date.now();
  const timestamps = (transferWindows.get(accountId) ?? []).filter((t) => t > now - WINDOW_MS);
  return Math.max(0, MAX_PER_WINDOW - timestamps.length);
}

/**
 * Returns the number of transfers from `accountId` within the current
 * 5-minute velocity alert window.  Distinct from {@link remainingAttempts}
 * which operates on the shorter 60-second rate-limit window.
 */
export function windowTransferCount(accountId: string): number {
  const now = Date.now();
  return (transferWindows.get(accountId) ?? []).filter((t) => t > now - VELOCITY_ALERT_WINDOW_MS).length;
}

/** Returns the total amount transferred from `accountId` in the current alert window. */
export function windowTransferTotal(accountId: string): number {
  const now = Date.now();
  return (transferAmounts.get(accountId) ?? [])
    .filter((e) => e.ts > now - VELOCITY_ALERT_WINDOW_MS)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Check whether an account's recent transfer **count** exceeds the velocity
 * alert threshold (6 transfers in 5 minutes).
 *
 * Call this **after** `checkAccountTransferLimit` has already recorded the
 * current attempt so the timestamp is included in the count.
 *
 * Returns `true` only on the **first** time the threshold is crossed in a
 * given window, then suppresses further alerts until the window resets.
 * This prevents log flooding and duplicate audit entries.
 *
 * @returns `true` when a new count-based alert should be emitted.
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

/**
 * Check whether the total **amount** transferred from an account in the
 * current 5-minute window exceeds the high-amount alert threshold ($10,000).
 *
 * Uses a separate `lastAlertTime` key (`amount:accountId`) so count-based
 * and amount-based alerts can fire independently without suppressing each other.
 *
 * @returns `true` when a new amount-based alert should be emitted.
 */
export function checkVelocityAmountAlert(accountId: string): boolean {
  const total = windowTransferTotal(accountId);
  if (total < VELOCITY_AMOUNT_THRESHOLD) return false;

  // Suppress repeated amount alerts within the same window.
  const amountAlertKey = `amount:${accountId}`;
  const now = Date.now();
  const lastAlert = lastAlertTime.get(amountAlertKey) ?? 0;
  if (now - lastAlert < VELOCITY_ALERT_WINDOW_MS) return false;

  lastAlertTime.set(amountAlertKey, now);
  return true;
}

/** Exposed for testing: clear all rate-limit and alert state. */
export function resetAccountLimits(): void {
  transferWindows.clear();
  transferAmounts.clear();
  lastAlertTime.clear();
}

/**
 * Compute a fraud risk score (0–100) for an account based on its current
 * in-window transfer count and cumulative amount.
 *
 * Scoring model:
 *   - Count component (0–50): count / alertThreshold × 50, capped at 50
 *   - Amount component (0–50): totalAmount / amountThreshold × 50, capped at 50
 *
 * A score of 50 means either the count or the amount threshold has been hit.
 * A score of 100 means both thresholds are simultaneously exceeded.
 */
export function computeFraudScore(count: number, totalAmountUsd: number): number {
  const countFactor = Math.min(1, count / VELOCITY_ALERT_THRESHOLD);
  const amountFactor = Math.min(1, totalAmountUsd / VELOCITY_AMOUNT_THRESHOLD);
  return Math.round(countFactor * 50 + amountFactor * 50);
}
