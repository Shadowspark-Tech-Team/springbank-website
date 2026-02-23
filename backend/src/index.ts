import express, { Request, Response, NextFunction } from 'express';
import { helmetConfig, corsConfig, generalLimiter, sessionTimeoutMiddleware } from './middleware/security';
import { requestIdMiddleware, log } from './middleware/logger';
import prisma from './db';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';
import adminRoutes from './routes/admin';

// Simple inflight counter guards the fire-and-forget audit-log writes in the
// error handler against unbounded queue growth during cascading failures.
let errorAuditInflight = 0;
const ERROR_AUDIT_MAX_INFLIGHT = 20;

const app = express();

app.use(helmetConfig);
app.use(corsConfig);
app.use(requestIdMiddleware);
app.use(generalLimiter);
app.use(sessionTimeoutMiddleware);
app.use(express.json({ limit: '10kb' }));

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
  log({
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
    prisma.auditLog.create({
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
      log({ level: 'error', requestId, message: `Failed to write error audit log: ${String(auditErr)}` });
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

export { app, prisma };
