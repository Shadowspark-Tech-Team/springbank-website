import { PrismaClient, Transaction, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

function generateReference(): string {
  return `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/** How many times to retry an optimistic-lock conflict before giving up. */
const MAX_OCC_RETRIES = 3;

export async function transfer(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  description: string,
  prisma: PrismaClient,
  actorUserId?: string,
  idempotencyKey?: string,
): Promise<Transaction> {
  // Idempotency guard: if a completed transaction exists for this key, return it.
  if (idempotencyKey) {
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
  }

  for (let attempt = 0; attempt < MAX_OCC_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Read accounts with their current version for optimistic locking.
        const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
        if (!fromAccount) throw new Error('Source account not found');
        if (!fromAccount.isActive) throw new Error('Source account is inactive');
        if (fromAccount.isFrozen) throw new Error('Source account is frozen');

        const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
        if (!toAccount) throw new Error('Destination account not found');
        if (!toAccount.isActive) throw new Error('Destination account is inactive');
        if (toAccount.isFrozen) throw new Error('Destination account is frozen');

        if (fromAccount.balance.lessThan(new Decimal(amount))) {
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
          throw new Error(
            `Double-entry invariant violated: sum before ${sumBefore.toFixed(2)} ≠ sum after ${sumAfter.toFixed(2)}`,
          );
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
    } catch (err) {
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

interface CreateTransactionParams {
  fromAccountId?: string;
  toAccountId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export async function createTransaction(
  params: CreateTransactionParams,
  prisma: PrismaClient,
): Promise<Transaction> {
  const { fromAccountId, toAccountId, type, amount, description, metadata, idempotencyKey } = params;

  // Idempotency guard.
  if (idempotencyKey) {
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
  }

  for (let attempt = 0; attempt < MAX_OCC_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        let currency = 'USD';

        if (fromAccountId) {
          const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
          if (!fromAccount) throw new Error('Source account not found');
          if (!fromAccount.isActive) throw new Error('Source account is inactive');
          if (fromAccount.isFrozen) throw new Error('Source account is frozen');
          if (fromAccount.balance.lessThan(new Decimal(amount))) throw new Error('Insufficient balance');

          const result = await tx.account.updateMany({
            where: { id: fromAccountId, version: fromAccount.version },
            data: { balance: { decrement: amount }, version: { increment: 1 } },
          });
          if (result.count === 0) throw new OccConflictError('Optimistic concurrency conflict on debit account');

          currency = fromAccount.currency;
        }

        if (toAccountId) {
          const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
          if (!toAccount) throw new Error('Destination account not found');
          if (!toAccount.isActive) throw new Error('Destination account is inactive');
          if (toAccount.isFrozen) throw new Error('Destination account is frozen');

          const result = await tx.account.updateMany({
            where: { id: toAccountId, version: toAccount.version },
            data: { balance: { increment: amount }, version: { increment: 1 } },
          });
          if (result.count === 0) throw new OccConflictError('Optimistic concurrency conflict on credit account');
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
            status: 'COMPLETED',
            metadata: metadata as object | undefined,
          },
        });

        return transaction;
      });
    } catch (err) {
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
  constructor(message: string) {
    super(message);
    this.name = 'OccConflictError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

