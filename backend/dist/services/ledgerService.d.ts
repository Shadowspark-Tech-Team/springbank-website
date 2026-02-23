import { Transaction, TransactionType } from '@prisma/client';
import type { ExtendedPrismaClient } from '../db';
export declare function transfer(fromAccountId: string, toAccountId: string, amount: number, description: string, prisma: ExtendedPrismaClient, actorUserId?: string, idempotencyKey?: string): Promise<Transaction>;
interface CreateTransactionParams {
    fromAccountId?: string;
    toAccountId?: string;
    type: TransactionType;
    amount: number;
    description: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
}
export declare function createTransaction(params: CreateTransactionParams, prisma: ExtendedPrismaClient): Promise<Transaction>;
/**
 * Raised when an idempotency key is presented with a payload that differs from
 * the one it was originally used with (e.g. same key, different amount).
 * Routes should catch this and respond with HTTP 409 Conflict.
 */
export declare class IdempotencyPayloadMismatchError extends Error {
    constructor(message: string);
}
export {};
//# sourceMappingURL=ledgerService.d.ts.map