import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import prisma from '../db';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const accounts = await prisma.account.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ accounts });
});

router.get('/:id', async (req: Request, res: Response) => {
  const account = await prisma.account.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });

  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const recentTransactions = await prisma.transaction.findMany({
    where: {
      OR: [{ fromAccountId: account.id }, { toAccountId: account.id }],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({ account, recentTransactions });
});

const txQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['INTERNAL_TRANSFER', 'EXTERNAL_TRANSFER', 'BILL_PAYMENT', 'DEPOSIT', 'WITHDRAWAL']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
});

router.get('/:id/transactions', async (req: Request, res: Response) => {
  const account = await prisma.account.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });

  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const parseResult = txQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid query parameters' });
    return;
  }

  const { page, limit, type, status } = parseResult.data;
  const skip = (page - 1) * limit;

  const where = {
    OR: [{ fromAccountId: account.id }, { toAccountId: account.id }],
    ...(type && { type }),
    ...(status && { status }),
  };

  const [transactions, total] = await prisma.$transaction([
    prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export default router;
