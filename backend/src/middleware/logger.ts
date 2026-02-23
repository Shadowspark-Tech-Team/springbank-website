import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/** Structured log levels aligned with common fintech logging standards. */
type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  requestId: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string;
  message: string;
  [key: string]: unknown;
}

/** Emit a single JSON log line to stdout/stderr. */
export function log(entry: LogEntry): void {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  if (entry.level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/**
 * Assigns a unique X-Request-ID to every incoming request and attaches it to
 * the request object.  Logs a structured entry for each completed response.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ?? `req_${randomUUID().replace(/-/g, '')}`;

  // Expose on the request so downstream code can include it in logs.
  (req as Request & { requestId: string }).requestId = requestId;

  // Echo back to the client so they can correlate client-side errors.
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const level: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log({
      level,
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: (req as Request & { user?: { userId: string } }).user?.userId,
      message: `${req.method} ${req.path} ${res.statusCode}`,
    });
  });

  next();
}

/** Augment Express Request type with requestId. */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
