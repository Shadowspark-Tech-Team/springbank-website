import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
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

const adjustSchema = z.object({
  amount: z.number(),
  description: z.string().min(1).max(500),
});

router.patch('/accounts/:id/adjust', validate(adjustSchema), async (req: Request, res: Response) => {
  const { amount, description } = req.body as z.infer<typeof adjustSchema>;

  const account = await prisma.account.findUnique({ where: { id: req.params.id } });
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const newBalance = Number(account.balance) + amount;
  if (newBalance < 0) {
    res.status(400).json({ error: 'Adjustment would result in negative balance' });
    return;
  }

  const updated = await prisma.account.update({
    where: { id: req.params.id },
    data: { balance: newBalance },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: 'balance_adjusted',
      resource: 'account',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { previousBalance: account.balance, adjustment: amount, newBalance, description },
    },
  });

  res.json({ account: updated });
});

export default router;
