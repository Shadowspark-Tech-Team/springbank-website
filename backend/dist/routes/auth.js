"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const security_1 = require("../middleware/security");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const authService_1 = require("../services/authService");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z
        .string()
        .min(8)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*()_+\-=\[\]{}]/, 'Password must contain at least one special character'),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
const resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
router.post('/register', security_1.authLimiter, (0, validate_1.validate)(registerSchema), async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    const existing = await db_1.default.user.findUnique({ where: { email } });
    if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
    }
    const hashed = await (0, authService_1.hashPassword)(password);
    const accountNumber = (0, authService_1.generateAccountNumber)();
    const user = await db_1.default.user.create({
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
    await db_1.default.auditLog.create({
        data: {
            userId: user.id,
            action: 'register',
            resource: 'user',
            resourceId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        },
    });
    const token = (0, authService_1.generateJwt)({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = (0, authService_1.generateRefreshToken)(user.id);
    await db_1.default.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash: (0, authService_1.hashToken)(refreshToken),
            expiresAt: (0, authService_1.refreshTokenExpiry)(),
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
router.post('/login', security_1.authLimiter, (0, validate_1.validate)(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const user = await db_1.default.user.findUnique({ where: { email } });
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
    const valid = await (0, authService_1.verifyPassword)(password, user.password);
    if (!valid) {
        const failedAttempts = user.failedAttempts + 1;
        const shouldLock = failedAttempts >= 5;
        await db_1.default.user.update({
            where: { id: user.id },
            data: { failedAttempts, isLocked: shouldLock },
        });
        await db_1.default.auditLog.create({
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
    await db_1.default.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0 },
    });
    await db_1.default.auditLog.create({
        data: {
            userId: user.id,
            action: 'login_success',
            resource: 'user',
            resourceId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        },
    });
    const token = (0, authService_1.generateJwt)({ userId: user.id, email: user.email, role: user.role }, '15m');
    const refreshToken = (0, authService_1.generateRefreshToken)(user.id);
    await db_1.default.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash: (0, authService_1.hashToken)(refreshToken),
            expiresAt: (0, authService_1.refreshTokenExpiry)(),
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
router.post('/refresh', security_1.authLimiter, (0, validate_1.validate)(refreshSchema), async (req, res) => {
    const { refreshToken } = req.body;
    // 1. Verify JWT signature and expiry.
    const payload = (0, authService_1.verifyRefreshToken)(refreshToken);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
    }
    // 2. Validate token exists in DB and has not been revoked (rotation check).
    const incomingHash = (0, authService_1.hashToken)(refreshToken);
    const stored = await db_1.default.refreshToken.findUnique({
        where: { tokenHash: incomingHash },
    });
    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
        // Possible token reuse — revoke ALL tokens for this user as a security measure.
        await db_1.default.refreshToken.updateMany({
            where: { userId: payload.userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        res.status(401).json({ error: 'Refresh token has been revoked or reused' });
        return;
    }
    const user = await db_1.default.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive || user.isLocked) {
        res.status(401).json({ error: 'User not available' });
        return;
    }
    // 3. Revoke the old token and issue a new one (rotation).
    const newRefreshToken = (0, authService_1.generateRefreshToken)(user.id);
    await db_1.default.$transaction([
        db_1.default.refreshToken.update({
            where: { tokenHash: incomingHash },
            data: { revokedAt: new Date() },
        }),
        db_1.default.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: (0, authService_1.hashToken)(newRefreshToken),
                expiresAt: (0, authService_1.refreshTokenExpiry)(),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] ?? null,
            },
        }),
    ]);
    const token = (0, authService_1.generateJwt)({ userId: user.id, email: user.email, role: user.role }, '15m');
    res.json({ token, refreshToken: newRefreshToken });
});
router.post('/logout', auth_1.authenticate, async (req, res) => {
    // Revoke all active refresh tokens for this user.
    await db_1.default.refreshToken.updateMany({
        where: { userId: req.user.userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    await db_1.default.auditLog.create({
        data: {
            userId: req.user.userId,
            action: 'logout',
            resource: 'user',
            resourceId: req.user.userId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        },
    });
    res.json({ message: 'Logged out successfully' });
});
router.post('/reset-password', security_1.authLimiter, (0, validate_1.validate)(resetPasswordSchema), async (req, res) => {
    const { email } = req.body;
    const user = await db_1.default.user.findUnique({ where: { email } });
    if (user) {
        await db_1.default.auditLog.create({
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
exports.default = router;
//# sourceMappingURL=auth.js.map