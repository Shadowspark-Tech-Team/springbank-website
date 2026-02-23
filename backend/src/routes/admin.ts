import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import { UserRole } from '../types';
import prisma from '../db';

const router = Router();


router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/users', async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    include: { accounts: true },
    orderBy: { createdAt: 'desc' },
  });
  const sanitized = users.map(({ password, twoFactorSecret, ...u }) => u);
  res.json({ users: sanitized });
});

router.get('/users/:id', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { accounts: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { password, twoFactorSecret, ...sanitized } = user;
  res.json({ user: sanitized });
});

const freezeSchema = z.object({
  freeze: z.boolean(),
  accountId: z.string().uuid(),
});

router.patch('/users/:id/freeze', validate(freezeSchema), async (req: Request, res: Response) => {
  const { freeze, accountId } = req.body as z.infer<typeof freezeSchema>;

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: req.params.id },
  });
  if (!account) {
    res.status(404).json({ error: 'Account not found for the specified user' });
    return;
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: { isFrozen: freeze },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: freeze ? 'account_frozen' : 'account_unfrozen',
      resource: 'account',
      resourceId: accountId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.json({ account: updated });
});

const lockSchema = z.object({
  lock: z.boolean(),
});

router.patch('/users/:id/lock', validate(lockSchema), async (req: Request, res: Response) => {
  const { lock } = req.body as z.infer<typeof lockSchema>;

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isLocked: lock, failedAttempts: lock ? user.failedAttempts : 0 },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: lock ? 'user_locked' : 'user_unlocked',
      resource: 'user',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  const { password, twoFactorSecret, ...sanitized } = updated;
  res.json({ user: sanitized });
});

const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
});

router.get('/audit-logs', async (req: Request, res: Response) => {
  const parseResult = auditQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid query parameters' });
    return;
  }

  const { page, limit, userId, action, resource } = parseResult.data;
  const skip = (page - 1) * limit;

  const where = {
    ...(userId && { userId }),
    ...(action && { action: { contains: action } }),
    ...(resource && { resource }),
  };

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// Audit logs are IMMUTABLE: no route may delete or mutate them.
// Any attempt to do so is an explicit 405 Method Not Allowed.
router.delete('/audit-logs', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Audit logs are immutable and cannot be deleted' });
});
router.delete('/audit-logs/:id', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Audit logs are immutable and cannot be deleted' });
});
router.patch('/audit-logs/:id', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Audit logs are immutable and cannot be modified' });
});
router.put('/audit-logs/:id', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Audit logs are immutable and cannot be modified' });
});

const adjustSchema = z.object({
  /** Amount in minor currency units (cents). Positive = credit, negative = debit. */
  amountCents: z.number().int(),
  description: z.string().min(1).max(500),
});

router.patch('/accounts/:id/adjust', validate(adjustSchema), async (req: Request, res: Response) => {
  const { amountCents, description } = req.body as z.infer<typeof adjustSchema>;

  const account = await prisma.account.findUnique({ where: { id: req.params.id } });
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  // Convert integer cents to major currency units using Decimal arithmetic to
  // avoid floating-point precision loss (e.g. 0.1 + 0.2 !== 0.3 in IEEE 754).
  const adjustment = new Decimal(amountCents).div(100);
  const newBalance = account.balance.plus(adjustment);

  if (newBalance.isNegative()) {
    res.status(400).json({ error: 'Adjustment would result in negative balance' });
    return;
  }

  // Positive = credit (funds entering the account); negative = debit (funds leaving).
  const isCredit = amountCents > 0;
  const adjustAmount = adjustment.abs();
  const reference = `ADJ-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  // Atomically: update balance, record Transaction and LedgerEntry, write audit log.
  // The Transaction record ensures reconcile.ts accounts for this adjustment
  // correctly via the LedgerEntry aggregation.
  const updated = await prisma.$transaction(async (tx) => {
    const updatedAccount = await tx.account.update({
      where: { id: req.params.id, version: account.version },
      data: { balance: newBalance, version: { increment: 1 } },
    });

    const txRecord = await tx.transaction.create({
      data: {
        fromAccountId: isCredit ? null : req.params.id,
        toAccountId: isCredit ? req.params.id : null,
        type: 'ADJUSTMENT',
        amount: adjustAmount,
        currency: account.currency,
        description,
        reference,
        status: 'COMPLETED',
        metadata: { adjustedBy: req.user!.userId, amountCents },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: txRecord.id,
        accountId: req.params.id,
        entryType: isCredit ? 'CREDIT' : 'DEBIT',
        amount: adjustAmount,
        balanceAfter: newBalance,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'balance_adjusted',
        resource: 'account',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          previousBalance: account.balance.toFixed(2),
          adjustmentCents: amountCents,
          newBalance: newBalance.toFixed(2),
          transactionId: txRecord.id,
          description,
        },
      },
    });

    return updatedAccount;
  });

  res.json({ account: updated });
});

// ─── Suspicious Activity Report (SAR) ─────────────────────────────────────────

const sarQuerySchema = z.object({
  /** ISO-8601 start of report window. Defaults to 30 days ago. */
  since: z.string().datetime({ offset: true }).optional(),
  /** ISO-8601 end of report window. Defaults to now. */
  until: z.string().datetime({ offset: true }).optional(),
});

/**
 * Generate a Suspicious Activity Report (SAR) from velocity alert audit logs.
 *
 * Groups `high_transfer_velocity` and `high_transfer_amount` alerts by account
 * and returns a structured report suitable for compliance review.
 */
router.get('/sar', async (req: Request, res: Response) => {
  const parseResult = sarQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parseResult.error.flatten() });
    return;
  }

  const { since, until } = parseResult.data;
  const reportSince = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const reportUntil = until ? new Date(until) : new Date();

  // Fetch all velocity / amount alerts in the requested window.
  const alerts = await prisma.auditLog.findMany({
    where: {
      action: { in: ['high_transfer_velocity', 'high_transfer_amount'] },
      createdAt: { gte: reportSince, lte: reportUntil },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group alerts by resourceId (accountId).
  const byAccount = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    if (!alert.resourceId) continue;
    const existing = byAccount.get(alert.resourceId) ?? [];
    existing.push(alert);
    byAccount.set(alert.resourceId, existing);
  }

  // Enrich each group with account metadata and compute per-account statistics.
  const suspiciousAccounts = await Promise.all(
    Array.from(byAccount.entries()).map(async ([accountId, accountAlerts]) => {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { accountNumber: true, userId: true, currency: true },
      });

      // Highest fraud score emitted across all alerts for this account.
      const maxFraudScore = accountAlerts.reduce((max, a) => {
        const details = a.details as Record<string, unknown>;
        const score = typeof details?.fraudScore === 'number' ? details.fraudScore : 0;
        return Math.max(max, score);
      }, 0);

      return {
        accountId,
        accountNumber: account?.accountNumber ?? 'unknown',
        userId: account?.userId ?? null,
        currency: account?.currency ?? 'USD',
        velocityAlerts: accountAlerts.filter((a) => a.action === 'high_transfer_velocity').length,
        amountAlerts: accountAlerts.filter((a) => a.action === 'high_transfer_amount').length,
        totalAlerts: accountAlerts.length,
        maxFraudScore,
        firstAlertAt: accountAlerts.at(0)?.createdAt ?? null,
        lastAlertAt: accountAlerts.at(-1)?.createdAt ?? null,
      };
    }),
  );

  // Sort by total alert count descending (highest risk first).
  suspiciousAccounts.sort((a, b) => b.totalAlerts - a.totalAlerts);

  res.json({
    reportGeneratedAt: new Date().toISOString(),
    reportPeriod: { since: reportSince.toISOString(), until: reportUntil.toISOString() },
    totalAlerts: alerts.length,
    suspiciousAccountCount: suspiciousAccounts.length,
    suspiciousAccounts,
  });
});

export default router;
