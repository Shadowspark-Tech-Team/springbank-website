import { PrismaClient, Transaction, TransactionType } from '@prisma/client';
import { randomUUID } from 'crypto';

function generateReference(): string {
  return `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function transfer(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  description: string,
  prisma: PrismaClient,
  actorUserId?: string,
): Promise<Transaction> {
  return prisma.$transaction(async (tx) => {
    const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
    if (!fromAccount) throw new Error('Source account not found');
    if (!fromAccount.isActive) throw new Error('Source account is inactive');
    if (fromAccount.isFrozen) throw new Error('Source account is frozen');

    const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
    if (!toAccount) throw new Error('Destination account not found');
    if (!toAccount.isActive) throw new Error('Destination account is inactive');
    if (toAccount.isFrozen) throw new Error('Destination account is frozen');

    if (Number(fromAccount.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    await tx.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    });

    await tx.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        fromAccountId,
        toAccountId,
        type: 'INTERNAL_TRANSFER',
        amount,
        currency: fromAccount.currency,
        description,
        reference: generateReference(),
        status: 'COMPLETED',
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorUserId ?? fromAccount.userId,
        action: 'internal_transfer',
        resource: 'transaction',
        resourceId: transaction.id,
        details: { fromAccountId, toAccountId, amount, description },
      },
    });

    return transaction;
  });
}

interface CreateTransactionParams {
  fromAccountId?: string;
  toAccountId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function createTransaction(
  params: CreateTransactionParams,
  prisma: PrismaClient,
): Promise<Transaction> {
  const { fromAccountId, toAccountId, type, amount, description, metadata } = params;

  return prisma.$transaction(async (tx) => {
    let currency = 'USD';

    if (fromAccountId) {
      const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
      if (!fromAccount) throw new Error('Source account not found');
      if (!fromAccount.isActive) throw new Error('Source account is inactive');
      if (fromAccount.isFrozen) throw new Error('Source account is frozen');
      if (Number(fromAccount.balance) < amount) throw new Error('Insufficient balance');

      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      });

      currency = fromAccount.currency;
    }

    if (toAccountId) {
      const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
      if (!toAccount) throw new Error('Destination account not found');
      if (!toAccount.isActive) throw new Error('Destination account is inactive');
      if (toAccount.isFrozen) throw new Error('Destination account is frozen');

      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });
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
        status: 'COMPLETED',
        metadata: metadata as object | undefined,
      },
    });

    return transaction;
  });
}
