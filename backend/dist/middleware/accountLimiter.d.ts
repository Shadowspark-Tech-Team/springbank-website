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
/**
 * Record a transfer attempt for `accountId` and check if the account has
 * exceeded the per-minute limit.
 *
 * @returns `true` when the request is within the limit (allowed).
 *          `false` when the limit has been exceeded (block the request).
 */
export declare function checkAccountTransferLimit(accountId: string): boolean;
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
export declare function recordTransferAmount(accountId: string, amount: number): void;
/** How many attempts remain in the current window for `accountId`. */
export declare function remainingAttempts(accountId: string): number;
/** Returns the total amount transferred from `accountId` in the current alert window. */
export declare function windowTransferTotal(accountId: string): number;
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
export declare function checkVelocityAlert(accountId: string): boolean;
/**
 * Check whether the total **amount** transferred from an account in the
 * current 5-minute window exceeds the high-amount alert threshold ($10,000).
 *
 * Uses a separate `lastAlertTime` key (`amount:accountId`) so count-based
 * and amount-based alerts can fire independently without suppressing each other.
 *
 * @returns `true` when a new amount-based alert should be emitted.
 */
export declare function checkVelocityAmountAlert(accountId: string): boolean;
/** Exposed for testing: clear all rate-limit and alert state. */
export declare function resetAccountLimits(): void;
//# sourceMappingURL=accountLimiter.d.ts.map