"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const ledgerService_1 = require("../services/ledgerService");
const accountLimiter_1 = require("../middleware/accountLimiter");
const logger_1 = require("../middleware/logger");
const types_1 = require("../types");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const transferSchema = zod_1.z.object({
    fromAccountId: zod_1.z.string().uuid(),
    toAccountId: zod_1.z.string().uuid(),
    /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
    amount: zod_1.z.number().int().positive(),
    description: zod_1.z.string().min(1).max(500),
});
const externalTransferSchema = zod_1.z.object({
    fromAccountId: zod_1.z.string().uuid(),
    /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
    amount: zod_1.z.number().int().positive(),
    description: zod_1.z.string().min(1).max(500),
    recipientName: zod_1.z.string().min(1).max(200),
    recipientBank: zod_1.z.string().min(1).max(200),
    recipientAccount: zod_1.z.string().min(1).max(50),
});
const billPaymentSchema = zod_1.z.object({
    fromAccountId: zod_1.z.string().uuid(),
    /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
    amount: zod_1.z.number().int().positive(),
    description: zod_1.z.string().min(1).max(500),
    billerName: zod_1.z.string().min(1).max(200),
    billerReference: zod_1.z.string().min(1).max(100),
});
const depositSchema = zod_1.z.object({
    toAccountId: zod_1.z.string().uuid(),
    /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
    amount: zod_1.z.number().int().positive(),
    description: zod_1.z.string().min(1).max(500),
});
const withdrawalSchema = zod_1.z.object({
    fromAccountId: zod_1.z.string().uuid(),
    /** Amount in minor currency units (cents), e.g. 5000 = $50.00 */
    amount: zod_1.z.number().int().positive(),
    description: zod_1.z.string().min(1).max(500),
});
/** Extract idempotency key from the Idempotency-Key header (trimmed, max 128 chars). */
function getIdempotencyKey(req) {
    const raw = req.headers['idempotency-key'];
    if (!raw)
        return undefined;
    const key = (Array.isArray(raw) ? raw[0] : raw).trim().slice(0, 128);
    return key || undefined;
}
/**
 * Record a committed transfer amount and emit structured alerts when count-based
 * or amount-based velocity thresholds are crossed.
 *
 * @param amount - Transfer amount in major currency units (e.g. 50.00 for $50).
 */
function handleVelocityAlert(accountId, userId, amount, req) {
    (0, accountLimiter_1.recordTransferAmount)(accountId, amount);
    const requestId = req.requestId ?? 'unknown';
    // Count-based velocity alert (6 transfers in 5 minutes).
    if ((0, accountLimiter_1.checkVelocityAlert)(accountId)) {
        (0, logger_1.log)({
            level: 'warn',
            requestId,
            message: 'High transfer velocity detected',
            accountId,
            userId,
        });
        db_1.default.auditLog.create({
            data: {
                userId,
                action: 'high_transfer_velocity',
                resource: 'account',
                resourceId: accountId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { requestId },
            },
        }).catch((err) => {
            (0, logger_1.log)({ level: 'error', requestId, message: `Failed to write velocity-alert audit log: ${String(err)}` });
        });
    }
    // Amount-based velocity alert ($10,000+ in 5 minutes).
    if ((0, accountLimiter_1.checkVelocityAmountAlert)(accountId)) {
        (0, logger_1.log)({
            level: 'warn',
            requestId,
            message: 'High transfer amount velocity detected',
            accountId,
            userId,
            windowTotalUsd: (0, accountLimiter_1.windowTransferTotal)(accountId),
        });
        db_1.default.auditLog.create({
            data: {
                userId,
                action: 'high_transfer_amount',
                resource: 'account',
                resourceId: accountId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { requestId },
            },
        }).catch((err) => {
            (0, logger_1.log)({ level: 'error', requestId, message: `Failed to write amount-alert audit log: ${String(err)}` });
        });
    }
}
router.post('/transfer', (0, validate_1.validate)(transferSchema), async (req, res) => {
    const { fromAccountId, toAccountId, amount, description } = req.body;
    const fromAccount = await db_1.default.account.findFirst({
        where: { id: fromAccountId, userId: req.user.userId },
    });
    if (!fromAccount) {
        res.status(403).json({ error: 'Source account not found or not owned by user' });
        return;
    }
    // Per-account rate limit: 10 transfers per 60 seconds.
    if (!(0, accountLimiter_1.checkAccountTransferLimit)(fromAccountId)) {
        res.status(429).json({
            error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
            remaining: (0, accountLimiter_1.remainingAttempts)(fromAccountId),
        });
        return;
    }
    const toAccount = await db_1.default.account.findFirst({
        where: { id: toAccountId },
    });
    if (!toAccount) {
        res.status(404).json({ error: 'Destination account not found' });
        return;
    }
    try {
        const tx = await (0, ledgerService_1.transfer)(fromAccountId, toAccountId, amount / 100, description, db_1.default, req.user.userId, getIdempotencyKey(req));
        handleVelocityAlert(fromAccountId, req.user.userId, amount / 100, req);
        res.status(201).json({ transaction: tx });
    }
    catch (err) {
        if (err instanceof ledgerService_1.IdempotencyPayloadMismatchError) {
            res.status(409).json({ error: err.message });
            return;
        }
        throw err;
    }
});
router.post('/external-transfer', (0, validate_1.validate)(externalTransferSchema), async (req, res) => {
    const { fromAccountId, amount, description, recipientName, recipientBank, recipientAccount } = req.body;
    const fromAccount = await db_1.default.account.findFirst({
        where: { id: fromAccountId, userId: req.user.userId },
    });
    if (!fromAccount) {
        res.status(403).json({ error: 'Source account not found or not owned by user' });
        return;
    }
    if (!(0, accountLimiter_1.checkAccountTransferLimit)(fromAccountId)) {
        res.status(429).json({
            error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
            remaining: (0, accountLimiter_1.remainingAttempts)(fromAccountId),
        });
        return;
    }
    try {
        const tx = await (0, ledgerService_1.createTransaction)({
            fromAccountId,
            type: 'EXTERNAL_TRANSFER',
            amount: amount / 100,
            description,
            metadata: { recipientName, recipientBank, recipientAccount },
            idempotencyKey: getIdempotencyKey(req),
        }, db_1.default);
        handleVelocityAlert(fromAccountId, req.user.userId, amount / 100, req);
        res.status(201).json({ transaction: tx });
    }
    catch (err) {
        if (err instanceof ledgerService_1.IdempotencyPayloadMismatchError) {
            res.status(409).json({ error: err.message });
            return;
        }
        throw err;
    }
});
router.post('/bill-payment', (0, validate_1.validate)(billPaymentSchema), async (req, res) => {
    const { fromAccountId, amount, description, billerName, billerReference } = req.body;
    const fromAccount = await db_1.default.account.findFirst({
        where: { id: fromAccountId, userId: req.user.userId },
    });
    if (!fromAccount) {
        res.status(403).json({ error: 'Source account not found or not owned by user' });
        return;
    }
    if (!(0, accountLimiter_1.checkAccountTransferLimit)(fromAccountId)) {
        res.status(429).json({
            error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
            remaining: (0, accountLimiter_1.remainingAttempts)(fromAccountId),
        });
        return;
    }
    try {
        const tx = await (0, ledgerService_1.createTransaction)({
            fromAccountId,
            type: 'BILL_PAYMENT',
            amount: amount / 100,
            description,
            metadata: { billerName, billerReference },
            idempotencyKey: getIdempotencyKey(req),
        }, db_1.default);
        handleVelocityAlert(fromAccountId, req.user.userId, amount / 100, req);
        res.status(201).json({ transaction: tx });
    }
    catch (err) {
        if (err instanceof ledgerService_1.IdempotencyPayloadMismatchError) {
            res.status(409).json({ error: err.message });
            return;
        }
        throw err;
    }
});
router.post('/deposit', (0, auth_1.requireRole)(types_1.UserRole.ADMIN, types_1.UserRole.STAFF), (0, validate_1.validate)(depositSchema), async (req, res) => {
    const { toAccountId, amount, description } = req.body;
    const tx = await (0, ledgerService_1.createTransaction)({
        toAccountId,
        type: 'DEPOSIT',
        amount: amount / 100,
        description,
        idempotencyKey: getIdempotencyKey(req),
    }, db_1.default);
    res.status(201).json({ transaction: tx });
});
router.post('/withdrawal', (0, validate_1.validate)(withdrawalSchema), async (req, res) => {
    const { fromAccountId, amount, description } = req.body;
    const fromAccount = await db_1.default.account.findFirst({
        where: { id: fromAccountId, userId: req.user.userId },
    });
    if (!fromAccount) {
        res.status(403).json({ error: 'Source account not found or not owned by user' });
        return;
    }
    if (!(0, accountLimiter_1.checkAccountTransferLimit)(fromAccountId)) {
        res.status(429).json({
            error: 'Transfer rate limit exceeded for this account. Please try again shortly.',
            remaining: (0, accountLimiter_1.remainingAttempts)(fromAccountId),
        });
        return;
    }
    try {
        const tx = await (0, ledgerService_1.createTransaction)({
            fromAccountId,
            type: 'WITHDRAWAL',
            amount: amount / 100,
            description,
            idempotencyKey: getIdempotencyKey(req),
        }, db_1.default);
        handleVelocityAlert(fromAccountId, req.user.userId, amount / 100, req);
        res.status(201).json({ transaction: tx });
    }
    catch (err) {
        if (err instanceof ledgerService_1.IdempotencyPayloadMismatchError) {
            res.status(409).json({ error: err.message });
            return;
        }
        throw err;
    }
});
exports.default = router;
//# sourceMappingURL=transactions.js.map