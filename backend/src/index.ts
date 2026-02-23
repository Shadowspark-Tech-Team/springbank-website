import express, { Request, Response, NextFunction } from 'express';
import { helmetConfig, corsConfig, generalLimiter, sessionTimeoutMiddleware } from './middleware/security';
import prisma from './db';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';
import adminRoutes from './routes/admin';

const app = express();

app.use(helmetConfig);
app.use(corsConfig);
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development';

  if (err.message.startsWith('Insufficient balance') ||
      err.message.startsWith('Source account') ||
      err.message.startsWith('Destination account') ||
      err.message.startsWith('Account')) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { details: err.message }),
  });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.listen(PORT, () => {
  console.log(`SpringBank API listening on port ${PORT}`);
});

export { app, prisma };
