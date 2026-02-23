"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyPayloadMismatchError = void 0;
exports.transfer = transfer;
exports.createTransaction = createTransaction;
const library_1 = require("@prisma/client/runtime/library");
const crypto_1 = require("crypto");
function generateReference() {
    return `TXN-${Date.now()}-${(0, crypto_1.randomUUID)().slice(0, 8).toUpperCase()}`;
}
/**
 * Compute a canonical SHA-256 fingerprint of the transaction payload.
 * Used to detect idempotency key reuse with a different payload —
 * e.g. a client that presents the same key for a different amount.
 *
 * Keys are sorted for determinism; values are JSON-serialised to avoid
 * collisions that pipe-delimited strings would allow (e.g. a pipe inside
 * an account ID suffix concatenated with an adjacent field).
 */
function computePayloadHash(type, fromAccountId, toAccountId, amount) {
    const canonical = JSON.stringify({
        amount,
        fromAccountId: fromAccountId ?? null,
        toAccountId: toAccountId ?? null,
        type,
    });
    return (0, crypto_1.createHash)('sha256').update(canonical).digest('hex');
}
/** How many times to retry an optimistic-lock conflict before giving up. */
const MAX_OCC_RETRIES = 3;
/**
 * Idempotency keys are honoured for this duration after the original request.
 * After expiry, the key is treated as unused — a new transaction may be created.
 * 24 hours matches Stripe's idempotency window and balances storage cost with
 * practical retry windows (network timeouts, client retries, etc.).
 */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** Returns the expiry Date for a freshly-created idempotency record. */
function idempotencyExpiry() {
    return new Date(Date.now() + IDEMPOTENCY_TTL_MS);
}
/**
 * Look up an idempotency key.
 * Returns the existing Transaction if found AND not yet expired.
 * Returns null if not found, or if the record has expired (allowing a new request through).
 * Throws IdempotencyPayloadMismatchError if found, non-expired, but payload differs.
 */
async function checkIdempotency(prisma, idempotencyKey, payloadHash) {
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (!existing)
        return null;
    // Expired record: treat as if the key was never used.
    if (existing.idempotencyExpiresAt && existing.idempotencyExpiresAt < new Date()) {
        return null;
    }
    if (existing.idempotencyPayloadHash !== payloadHash) {
        throw new IdempotencyPayloadMismatchError('Idempotency key has already been used with a different payload');
    }
    return existing;
}
async function transfer(fromAccountId, toAccountId, amount, description, prisma, actorUserId, idempotencyKey) {
    // Idempotency guard: if a non-expired transaction exists for this key, return it.
    // The payload hash binds the key to the specific request body — prevents replaying
    // the same key with a different amount or account (Stripe-style payload binding).
    if (idempotencyKey) {
        const payloadHash = computePayloadHash('INTERNAL_TRANSFER', fromAccountId, toAccountId, amount);
        const existing = await checkIdempotency(prisma, idempotencyKey, payloadHash);
        if (existing)
            return existing;
    }
    for (let attempt = 0; attempt < MAX_OCC_RETRIES; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Read accounts with their current version for optimistic locking.
                const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
                if (!fromAccount)
                    throw new Error('Source account not found');
                if (!fromAccount.isActive)
                    throw new Error('Source account is inactive');
                if (fromAccount.isFrozen)
                    throw new Error('Source account is frozen');
                const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
                if (!toAccount)
                    throw new Error('Destination account not found');
                if (!toAccount.isActive)
                    throw new Error('Destination account is inactive');
                if (toAccount.isFrozen)
                    throw new Error('Destination account is frozen');
                if (fromAccount.balance.lessThan(new library_1.Decimal(amount))) {
                    throw new Error('Insufficient balance');
                }
                // Optimistic locking: update only if version matches what we read.
                // If another concurrent write changed the row, count returns 0 and we retry.
                const [debitResult, creditResult] = await Promise.all([
                    tx.account.updateMany({
                        where: { id: fromAccountId, version: fromAccount.version },
                        data: { balance: { decrement: amount }, version: { increment: 1 } },
                    }),
                    tx.account.updateMany({
                        where: { id: toAccountId, version: toAccount.version },
                        data: { balance: { increment: amount }, version: { increment: 1 } },
                    }),
                ]);
                if (debitResult.count === 0 || creditResult.count === 0) {
                    throw new OccConflictError('Optimistic concurrency conflict on account update');
                }
                // Double-entry invariant: verify conservation of funds.
                const [updatedFrom, updatedTo] = await Promise.all([
                    tx.account.findUniqueOrThrow({ where: { id: fromAccountId }, select: { balance: true } }),
                    tx.account.findUniqueOrThrow({ where: { id: toAccountId }, select: { balance: true } }),
                ]);
                const sumBefore = fromAccount.balance.plus(toAccount.balance);
                const sumAfter = updatedFrom.balance.plus(updatedTo.balance);
                if (!sumBefore.equals(sumAfter)) {
                    throw new Error(`Double-entry invariant violated: sum before ${sumBefore.toFixed(2)} ≠ sum after ${sumAfter.toFixed(2)}`);
                }
                const transaction = await tx.transaction.create({
                    data: {
                        fromAccountId,
                        toAccountId,
                        type: 'INTERNAL_TRANSFER',
                        amount,
                        currency: fromAccount.currency,
                        description,
                        reference: generateReference(),
                        idempotencyKey: idempotencyKey ?? null,
                        idempotencyPayloadHash: idempotencyKey
                            ? computePayloadHash('INTERNAL_TRANSFER', fromAccountId, toAccountId, amount)
                            : null,
                        idempotencyExpiresAt: idempotencyKey ? idempotencyExpiry() : null,
                        status: 'COMPLETED',
                    },
                });
                await tx.auditLog.create({
                    data: {
                        userId: actorUserId ?? fromAccount.userId,
                        action: 'internal_transfer',
                        resource: 'transaction',
                        resourceId: transaction.id,
                        details: { fromAccountId, toAccountId, amount, description, idempotencyKey },
                    },
                });
                return transaction;
            });
        }
        catch (err) {
            if (err instanceof OccConflictError && attempt < MAX_OCC_RETRIES - 1) {
                // Brief back-off before retry (exponential: 10ms, 20ms).
                await sleep(10 * Math.pow(2, attempt));
                continue;
            }
            throw err;
        }
    }
    // TypeScript flow-analysis safeguard: all paths above either return or throw.
    throw new Error('Unreachable code after retry loop');
}
async function createTransaction(params, prisma) {
    const { fromAccountId, toAccountId, type, amount, description, metadata, idempotencyKey } = params;
    // Idempotency guard: verify payload hash on replay to prevent key reuse
    // with a different payload (e.g. same key but different amount).
    if (idempotencyKey) {
        const payloadHash = computePayloadHash(type, fromAccountId, toAccountId, amount);
        const existing = await checkIdempotency(prisma, idempotencyKey, payloadHash);
        if (existing)
            return existing;
    }
    for (let attempt = 0; attempt < MAX_OCC_RETRIES; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                let currency = 'USD';
                if (fromAccountId) {
                    const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
                    if (!fromAccount)
                        throw new Error('Source account not found');
                    if (!fromAccount.isActive)
                        throw new Error('Source account is inactive');
                    if (fromAccount.isFrozen)
                        throw new Error('Source account is frozen');
                    if (fromAccount.balance.lessThan(new library_1.Decimal(amount)))
                        throw new Error('Insufficient balance');
                    const result = await tx.account.updateMany({
                        where: { id: fromAccountId, version: fromAccount.version },
                        data: { balance: { decrement: amount }, version: { increment: 1 } },
                    });
                    if (result.count === 0)
                        throw new OccConflictError('Optimistic concurrency conflict on debit account');
                    currency = fromAccount.currency;
                }
                if (toAccountId) {
                    const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
                    if (!toAccount)
                        throw new Error('Destination account not found');
                    if (!toAccount.isActive)
                        throw new Error('Destination account is inactive');
                    if (toAccount.isFrozen)
                        throw new Error('Destination account is frozen');
                    const result = await tx.account.updateMany({
                        where: { id: toAccountId, version: toAccount.version },
                        data: { balance: { increment: amount }, version: { increment: 1 } },
                    });
                    if (result.count === 0)
                        throw new OccConflictError('Optimistic concurrency conflict on credit account');
                }
                const transaction = await tx.transaction.create({
                    data: {
                        fromAccountId,
                        toAccountId,
                        type,
                        amount,
                        currency,
                        description,
                        reference: generateReference(),
                        idempotencyKey: idempotencyKey ?? null,
                        idempotencyPayloadHash: idempotencyKey
                            ? computePayloadHash(type, fromAccountId, toAccountId, amount)
                            : null,
                        idempotencyExpiresAt: idempotencyKey ? idempotencyExpiry() : null,
                        status: 'COMPLETED',
                        metadata: metadata,
                    },
                });
                return transaction;
            });
        }
        catch (err) {
            if (err instanceof OccConflictError && attempt < MAX_OCC_RETRIES - 1) {
                await sleep(10 * Math.pow(2, attempt));
                continue;
            }
            throw err;
        }
    }
    // TypeScript flow-analysis safeguard: all paths above either return or throw.
    throw new Error('Unreachable code after retry loop');
}
/** Sentinel error class for optimistic-concurrency conflicts (retried internally). */
class OccConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OccConflictError';
    }
}
/**
 * Raised when an idempotency key is presented with a payload that differs from
 * the one it was originally used with (e.g. same key, different amount).
 * Routes should catch this and respond with HTTP 409 Conflict.
 */
class IdempotencyPayloadMismatchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IdempotencyPayloadMismatchError';
    }
}
exports.IdempotencyPayloadMismatchError = IdempotencyPayloadMismatchError;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=ledgerService.js.map