"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const security_1 = require("./middleware/security");
const logger_1 = require("./middleware/logger");
const db_1 = __importDefault(require("./db"));
exports.prisma = db_1.default;
const auth_1 = __importDefault(require("./routes/auth"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const admin_1 = __importDefault(require("./routes/admin"));
// Simple inflight counter guards the fire-and-forget audit-log writes in the
// error handler against unbounded queue growth during cascading failures.
let errorAuditInflight = 0;
const ERROR_AUDIT_MAX_INFLIGHT = 20;
const app = (0, express_1.default)();
exports.app = app;
app.use(security_1.helmetConfig);
app.use(security_1.corsConfig);
app.use(logger_1.requestIdMiddleware);
app.use(security_1.generalLimiter);
app.use(security_1.sessionTimeoutMiddleware);
app.use(express_1.default.json({ limit: '10kb' }));
app.get('/health', async (_req, res) => {
    try {
        await db_1.default.$queryRaw `SELECT 1`;
        res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    }
    catch {
        res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
});
app.use('/api/auth', auth_1.default);
app.use('/api/accounts', accounts_1.default);
app.use('/api/transactions', transactions_1.default);
app.use('/api/admin', admin_1.default);
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, req, res, _next) => {
    const isDev = process.env.NODE_ENV === 'development';
    const requestId = req.requestId ?? 'unknown';
    if (err.message.startsWith('Insufficient balance') ||
        err.message.startsWith('Source account') ||
        err.message.startsWith('Destination account') ||
        err.message.startsWith('Account')) {
        res.status(400).json({ error: err.message });
        return;
    }
    // Structured error log with correlation ID.
    (0, logger_1.log)({
        level: 'error',
        requestId,
        message: `Unhandled error: ${err.message}`,
        stack: isDev ? err.stack : undefined,
        userId: req.user?.userId,
        path: req.path,
        method: req.method,
    });
    // Persist unexpected errors to the audit log for compliance visibility.
    // Guard against unbounded inflight writes during cascading failures.
    if (errorAuditInflight < ERROR_AUDIT_MAX_INFLIGHT) {
        errorAuditInflight++;
        db_1.default.auditLog.create({
            data: {
                userId: req.user?.userId ?? null,
                action: 'unhandled_error',
                resource: 'system',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: {
                    requestId,
                    path: req.path,
                    method: req.method,
                    message: err.message,
                    ...(isDev && { stack: err.stack }),
                },
            },
        }).catch((auditErr) => {
            // Do not throw from the error handler; log the secondary failure instead.
            (0, logger_1.log)({ level: 'error', requestId, message: `Failed to write error audit log: ${String(auditErr)}` });
        }).finally(() => { errorAuditInflight--; });
    }
    res.status(500).json({
        error: 'Internal server error',
        requestId,
        ...(isDev && { details: err.message }),
    });
});
const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
    console.log(`SpringBank API listening on port ${PORT}`);
});
//# sourceMappingURL=index.js.map