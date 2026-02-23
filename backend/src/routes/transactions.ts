import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { transfer, createTransaction, IdempotencyPayloadMismatchError } from '../services/ledgerService';
import { checkAccountTransferLimit, checkVelocityAlert, checkVelocityAmountAlert, recordTransferAmount, remainingAttempts, windowTransferTotal } from '../middleware/accountLimiter';
import { log } from '../middleware/logger';
import { UserRole } from '../types';
import prisma from '../db';

const router = Router();

router.use(authenticate);

const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
  amount: z.number().int().positive(),
  description: z.string().min(1).max(500),
});

const externalTransferSchema = z.object({
  fromAccountId: z.string().uuid(),
  /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
  amount: z.number().int().positive(),
  description: z.string().min(1).max(500),
  recipientName: z.string().min(1).max(200),
  recipientBank: z.string().min(1).max(200),
  recipientAccount: z.string().min(1).max(50),
});

const billPaymentSchema = z.object({
  fromAccountId: z.string().uuid(),
  /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
  amount: z.number().int().positive(),
  description: z.string().min(1).max(500),
  billerName: z.string().min(1).max(200),
  billerReference: z.string().min(1).max(100),
});

const depositSchema = z.object({
  toAccountId: z.string().uuid(),
  /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
  amount: z.number().int().positive(),
  description: z.string().min(1).max(500),
});

const withdrawalSchema = z.object({
  fromAccountId: z.string().uuid(),
  /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
  amount: z.number().int().positive(),
  description: z.string().min(1).max(500),
});

/** Extract idempotency key from the Idempotency-Key header (trimmed, max 128 chars). */
function getIdempotencyKey(req: Request): string | undefined {
  const raw = req.headers['idempotency-key'];
  if (!raw) return undefined;
  const key = (Array.isArray(raw) ? raw[0] : raw).trim().slice(0, 128);
  return key || undefined;
}

/**
 * Record a committed transfer amount and emit structured alerts when count-based
 * or amount-based velocity thresholds are crossed.
 *
 * @param amount - Transfer amount in major currency units (e.g. 50.00 for $50).
 */
function handleVelocityAlert(accountId: string, userId: string, amount: number, req: Request): void {
  recordTransferAmount(accountId, amount);

  const requestId = req.requestId ?? 'unknown';

  // Count-based velocity alert (6 transfers in 5 minutes).
  if (checkVelocityAlert(accountId)) {
    log({
      level: 'warn',
      requestId,
      message: 'High transfer velocity detected',
      accountId,
      userId,
    });

    prisma.auditLog.create({
      data: {
        userId,
        action: 'high_transfer_velocity',
        resource: 'account',
        resourceId: accountId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { requestId },
      },
    }).catch((err: unknown) => {
      log({ level: 'error', requestId, message: `Failed to write velocity-alert audit log: ${String(err)}` });
    });
  }

  // Amount-based velocity alert ($10,000+ in 5 minutes).
  if (checkVelocityAmountAlert(accountId)) {
    log({
      level: 'warn',
      requestId,
      message: 'High transfer amount velocity detected',
      accountId,
      userId,
      windowTotalUsd: windowTransferTotal(accountId),
    });

    prisma.auditLog.create({
      data: {
        userId,
        action: 'high_transfer_amount',
        resource: 'account',
        resourceId: accountId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { requestId },
      },
    }).catch((err: unknown) => {
      log({ level: 'error', requestId, message: `Failed to write amount-alert audit log: ${String(err)}` });
    });
  }
}

router.post('/transfer', validate(transferSchema), async (req: Request, res: Response) => {
  const { fromAccountId, toAccountId, amount, description } = req.body as z.infer<typeof transferSchema>;

  const fromAccount = await prisma.account.findFirst({
    where: { id: fromAccountId, userId: req.user!.userId },
  });
  if (!fromAccount) {
    res.status(403).json({ error: 'Source account not found or not owned by user' });
    return;
  }

  // Per-account rate limit: 10 transfers per 60 seconds.
  if (!checkAccountTransferLimit(fromAccountId)) {
    res.status(429).json({
      error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
      remaining: remainingAttempts(fromAccountId),
    });
    return;
  }

  const toAccount = await prisma.account.findFirst({
    where: { id: toAccountId },
  });
  if (!toAccount) {
    res.status(404).json({ error: 'Destination account not found' });
    return;
  }

  try {
    const tx = await transfer(
      fromAccountId,
      toAccountId,
      amount / 100,
      description,
      prisma,
      req.user!.userId,
      getIdempotencyKey(req),
    );
    handleVelocityAlert(fromAccountId, req.user!.userId, amount / 100, req);
    res.status(201).json({ transaction: tx });
  } catch (err) {
    if (err instanceof IdempotencyPayloadMismatchError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post('/external-transfer', validate(externalTransferSchema), async (req: Request, res: Response) => {
  const { fromAccountId, amount, description, recipientName, recipientBank, recipientAccount } =
    req.body as z.infer<typeof externalTransferSchema>;

  const fromAccount = await prisma.account.findFirst({
    where: { id: fromAccountId, userId: req.user!.userId },
  });
  if (!fromAccount) {
    res.status(403).json({ error: 'Source account not found or not owned by user' });
    return;
  }

  if (!checkAccountTransferLimit(fromAccountId)) {
    res.status(429).json({
      error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
      remaining: remainingAttempts(fromAccountId),
    });
    return;
  }

  try {
    const tx = await createTransaction(
      {
        fromAccountId,
        type: 'EXTERNAL_TRANSFER',
        amount: amount / 100,
        description,
        metadata: { recipientName, recipientBank, recipientAccount },
        idempotencyKey: getIdempotencyKey(req),
      },
      prisma,
    );
    handleVelocityAlert(fromAccountId, req.user!.userId, amount / 100, req);
    res.status(201).json({ transaction: tx });
  } catch (err) {
    if (err instanceof IdempotencyPayloadMismatchError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post('/bill-payment', validate(billPaymentSchema), async (req: Request, res: Response) => {
  const { fromAccountId, amount, description, billerName, billerReference } =
    req.body as z.infer<typeof billPaymentSchema>;

  const fromAccount = await prisma.account.findFirst({
    where: { id: fromAccountId, userId: req.user!.userId },
  });
  if (!fromAccount) {
    res.status(403).json({ error: 'Source account not found or not owned by user' });
    return;
  }

  if (!checkAccountTransferLimit(fromAccountId)) {
    res.status(429).json({
      error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
      remaining: remainingAttempts(fromAccountId),
    });
    return;
  }

  try {
    const tx = await createTransaction(
      {
        fromAccountId,
        type: 'BILL_PAYMENT',
        amount: amount / 100,
        description,
        metadata: { billerName, billerReference },
        idempotencyKey: getIdempotencyKey(req),
      },
      prisma,
    );
    handleVelocityAlert(fromAccountId, req.user!.userId, amount / 100, req);
    res.status(201).json({ transaction: tx });
  } catch (err) {
    if (err instanceof IdempotencyPayloadMismatchError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post(
  '/deposit',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  validate(depositSchema),
  async (req: Request, res: Response) => {
    const { toAccountId, amount, description } = req.body as z.infer<typeof depositSchema>;

    const tx = await createTransaction(
      {
        toAccountId,
        type: 'DEPOSIT',
        amount: amount / 100,
        description,
        idempotencyKey: getIdempotencyKey(req),
      },
      prisma,
    );
    res.status(201).json({ transaction: tx });
  },
);

router.post('/withdrawal', validate(withdrawalSchema), async (req: Request, res: Response) => {
  const { fromAccountId, amount, description } = req.body as z.infer<typeof withdrawalSchema>;

  const fromAccount = await prisma.account.findFirst({
    where: { id: fromAccountId, userId: req.user!.userId },
  });
  if (!fromAccount) {
    res.status(403).json({ error: 'Source account not found or not owned by user' });
    return;
  }

  if (!checkAccountTransferLimit(fromAccountId)) {
    res.status(429).json({
      error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
      remaining: remainingAttempts(fromAccountId),
    });
    return;
  }

  try {
    const tx = await createTransaction(
      {
        fromAccountId,
        type: 'WITHDRAWAL',
        amount: amount / 100,
        description,
        idempotencyKey: getIdempotencyKey(req),
      },
      prisma,
    );
    handleVelocityAlert(fromAccountId, req.user!.userId, amount / 100, req);
    res.status(201).json({ transaction: tx });
  } catch (err) {
    if (err instanceof IdempotencyPayloadMismatchError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

