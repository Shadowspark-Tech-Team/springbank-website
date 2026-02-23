"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    const accounts = await db_1.default.account.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'asc' },
    });
    res.json({ accounts });
});
router.get('/:id', async (req, res) => {
    const account = await db_1.default.account.findFirst({
        where: { id: req.params.id, userId: req.user.userId },
    });
    if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
    }
    const recentTransactions = await db_1.default.transaction.findMany({
        where: {
            OR: [{ fromAccountId: account.id }, { toAccountId: account.id }],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });
    res.json({ account, recentTransactions });
});
const txQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    type: zod_1.z.enum(['INTERNAL_TRANSFER', 'EXTERNAL_TRANSFER', 'BILL_PAYMENT', 'DEPOSIT', 'WITHDRAWAL']).optional(),
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
});
router.get('/:id/transactions', async (req, res) => {
    const account = await db_1.default.account.findFirst({
        where: { id: req.params.id, userId: req.user.userId },
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
    const [transactions, total] = await db_1.default.$transaction([
        db_1.default.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        db_1.default.transaction.count({ where }),
    ]);
    res.json({
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
});
exports.default = router;
//# sourceMappingURL=accounts.js.map