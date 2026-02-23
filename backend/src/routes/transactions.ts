import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { transfer, createTransaction } from '../services/ledgerService';
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

router.post('/transfer', validate(transferSchema), async (req: Request, res: Response) => {
  const { fromAccountId, toAccountId, amount, description } = req.body as z.infer<typeof transferSchema>;

  const fromAccount = await prisma.account.findFirst({
    where: { id: fromAccountId, userId: req.user!.userId },
  });
  if (!fromAccount) {
    res.status(403).json({ error: 'Source account not found or not owned by user' });
    return;
  }

  const toAccount = await prisma.account.findFirst({
    where: { id: toAccountId },
  });
  if (!toAccount) {
    res.status(404).json({ error: 'Destination account not found' });
    return;
  }

  const tx = await transfer(fromAccountId, toAccountId, amount / 100, description, prisma, req.user!.userId);
  res.status(201).json({ transaction: tx });
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

  const tx = await createTransaction(
    {
      fromAccountId,
      type: 'EXTERNAL_TRANSFER',
      amount: amount / 100,
      description,
      metadata: { recipientName, recipientBank, recipientAccount },
    },
    prisma,
  );
  res.status(201).json({ transaction: tx });
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

  const tx = await createTransaction(
    {
      fromAccountId,
      type: 'BILL_PAYMENT',
      amount: amount / 100,
      description,
      metadata: { billerName, billerReference },
    },
    prisma,
  );
  res.status(201).json({ transaction: tx });
});

router.post(
  '/deposit',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  validate(depositSchema),
  async (req: Request, res: Response) => {
    const { toAccountId, amount, description } = req.body as z.infer<typeof depositSchema>;

    const tx = await createTransaction(
      { toAccountId, type: 'DEPOSIT', amount: amount / 100, description },
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

  const tx = await createTransaction(
    { fromAccountId, type: 'WITHDRAWAL', amount: amount / 100, description },
    prisma,
  );
  res.status(201).json({ transaction: tx });
});

export default router;
