import { Request, Response, NextFunction } from 'express';
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
export declare function log(entry: LogEntry): void;
/**
 * Assigns a unique X-Request-ID to every incoming request and attaches it to
 * the request object.  Logs a structured entry for each completed response.
 */
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
/** Augment Express Request type with requestId. */
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}
export {};
//# sourceMappingURL=logger.d.ts.map