"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const library_1 = require("@prisma/client/runtime/library");
const types_1 = require("../types");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.requireRole)(types_1.UserRole.ADMIN));
router.get('/users', async (req, res) => {
    const users = await db_1.default.user.findMany({
        include: { accounts: true },
        orderBy: { createdAt: 'desc' },
    });
    const sanitized = users.map(({ password, twoFactorSecret, ...u }) => u);
    res.json({ users: sanitized });
});
router.get('/users/:id', async (req, res) => {
    const user = await db_1.default.user.findUnique({
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
const freezeSchema = zod_1.z.object({
    freeze: zod_1.z.boolean(),
    accountId: zod_1.z.string().uuid(),
});
router.patch('/users/:id/freeze', (0, validate_1.validate)(freezeSchema), async (req, res) => {
    const { freeze, accountId } = req.body;
    const account = await db_1.default.account.findFirst({
        where: { id: accountId, userId: req.params.id },
    });
    if (!account) {
        res.status(404).json({ error: 'Account not found for the specified user' });
        return;
    }
    const updated = await db_1.default.account.update({
        where: { id: accountId },
        data: { isFrozen: freeze },
    });
    await db_1.default.auditLog.create({
        data: {
            userId: req.user.userId,
            action: freeze ? 'account_frozen' : 'account_unfrozen',
            resource: 'account',
            resourceId: accountId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        },
    });
    res.json({ account: updated });
});
const lockSchema = zod_1.z.object({
    lock: zod_1.z.boolean(),
});
router.patch('/users/:id/lock', (0, validate_1.validate)(lockSchema), async (req, res) => {
    const { lock } = req.body;
    const user = await db_1.default.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const updated = await db_1.default.user.update({
        where: { id: req.params.id },
        data: { isLocked: lock, failedAttempts: lock ? user.failedAttempts : 0 },
    });
    await db_1.default.auditLog.create({
        data: {
            userId: req.user.userId,
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
const auditQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    userId: zod_1.z.string().uuid().optional(),
    action: zod_1.z.string().optional(),
    resource: zod_1.z.string().optional(),
});
router.get('/audit-logs', async (req, res) => {
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
    const [logs, total] = await db_1.default.$transaction([
        db_1.default.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        db_1.default.auditLog.count({ where }),
    ]);
    res.json({
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
});
// Audit logs are IMMUTABLE: no route may delete or mutate them.
// Any attempt to do so is an explicit 405 Method Not Allowed.
router.delete('/audit-logs', (_req, res) => {
    res.status(405).json({ error: 'Audit logs are immutable and cannot be deleted' });
});
router.delete('/audit-logs/:id', (_req, res) => {
    res.status(405).json({ error: 'Audit logs are immutable and cannot be deleted' });
});
router.patch('/audit-logs/:id', (_req, res) => {
    res.status(405).json({ error: 'Audit logs are immutable and cannot be modified' });
});
router.put('/audit-logs/:id', (_req, res) => {
    res.status(405).json({ error: 'Audit logs are immutable and cannot be modified' });
});
const adjustSchema = zod_1.z.object({
    /** Amount in minor currency units (cents). Positive = credit, negative = debit. */
    amountCents: zod_1.z.number().int(),
    description: zod_1.z.string().min(1).max(500),
});
router.patch('/accounts/:id/adjust', (0, validate_1.validate)(adjustSchema), async (req, res) => {
    const { amountCents, description } = req.body;
    const account = await db_1.default.account.findUnique({ where: { id: req.params.id } });
    if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
    }
    // Convert integer cents to major currency units using Decimal arithmetic to
    // avoid floating-point precision loss (e.g. 0.1 + 0.2 !== 0.3 in IEEE 754).
    const adjustment = new library_1.Decimal(amountCents).div(100);
    const newBalance = account.balance.plus(adjustment);
    if (newBalance.isNegative()) {
        res.status(400).json({ error: 'Adjustment would result in negative balance' });
        return;
    }
    const updated = await db_1.default.account.update({
        where: { id: req.params.id },
        data: { balance: newBalance },
    });
    await db_1.default.auditLog.create({
        data: {
            userId: req.user.userId,
            action: 'balance_adjusted',
            resource: 'account',
            resourceId: req.params.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
                previousBalance: account.balance.toFixed(2),
                adjustmentCents: amountCents,
                newBalance: newBalance.toFixed(2),
                description,
            },
        },
    });
    res.json({ account: updated });
});
exports.default = router;
//# sourceMappingURL=admin.js.map