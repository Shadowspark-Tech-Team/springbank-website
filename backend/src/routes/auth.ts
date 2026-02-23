import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/security';
import { authenticate } from '../middleware/auth';
import prisma from '../db';
import {
  generateJwt,
  generateRefreshToken,
  verifyRefreshToken,
  generateAccountNumber,
  hashPassword,
  verifyPassword,
  hashToken,
  refreshTokenExpiry,
} from '../services/authService';
import { UserRole } from '../types';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body as z.infer<typeof registerSchema>;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const hashed = await hashPassword(password);
  const accountNumber = generateAccountNumber();

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      firstName,
      lastName,
      role: 'CUSTOMER',
      accounts: {
        create: {
          accountNumber,
          accountType: 'CHECKING',
          currency: 'USD',
        },
      },
    },
    include: { accounts: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'register',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  const token = generateJwt({ userId: user.id, email: user.email, role: user.role as UserRole });
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    },
  });

  res.status(201).json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    accounts: user.accounts,
  });
});

router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Account is deactivated' });
    return;
  }

  if (user.isLocked) {
    res.status(403).json({ error: 'Account is locked due to too many failed attempts' });
    return;
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    const failedAttempts = user.failedAttempts + 1;
    const shouldLock = failedAttempts >= 5;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts, isLocked: shouldLock },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth_attempt_failed',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { failedAttempts },
      },
    });
    if (shouldLock) {
      res.status(403).json({ error: 'Account locked after too many failed attempts' });
      return;
    }
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0 },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'login_success',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  const token = generateJwt({ userId: user.id, email: user.email, role: user.role as UserRole }, '15m');
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    },
  });

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

router.post('/refresh', authLimiter, validate(refreshSchema), async (req: Request, res: Response) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

  // 1. Verify JWT signature and expiry.
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  // 2. Validate token exists in DB and has not been revoked (rotation check).
  const incomingHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: incomingHash },
  });
  if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
    // Possible token reuse — revoke ALL tokens for this user as a security measure.
    await prisma.refreshToken.updateMany({
      where: { userId: payload.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(401).json({ error: 'Refresh token has been revoked or reused' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive || user.isLocked) {
    res.status(401).json({ error: 'User not available' });
    return;
  }

  // 3. Revoke the old token and issue a new one (rotation).
  const newRefreshToken = generateRefreshToken(user.id);
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { tokenHash: incomingHash },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    }),
  ]);

  const token = generateJwt({ userId: user.id, email: user.email, role: user.role as UserRole }, '15m');
  res.json({ token, refreshToken: newRefreshToken });
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  // Revoke all active refresh tokens for this user.
  await prisma.refreshToken.updateMany({
    where: { userId: req.user!.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: 'logout',
      resource: 'user',
      resourceId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });
  res.json({ message: 'Logged out successfully' });
});

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  const { email } = req.body as z.infer<typeof resetPasswordSchema>;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'password_reset_requested',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
});

export default router;
