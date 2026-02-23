"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.requestIdMiddleware = requestIdMiddleware;
const crypto_1 = require("crypto");
/** Emit a single JSON log line to stdout/stderr. */
function log(entry) {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
    if (entry.level === 'error') {
        process.stderr.write(line + '\n');
    }
    else {
        process.stdout.write(line + '\n');
    }
}
/**
 * Assigns a unique X-Request-ID to every incoming request and attaches it to
 * the request object.  Logs a structured entry for each completed response.
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] ?? `req_${(0, crypto_1.randomUUID)().replace(/-/g, '')}`;
    // Expose on the request so downstream code can include it in logs.
    req.requestId = requestId;
    // Echo back to the client so they can correlate client-side errors.
    res.setHeader('X-Request-ID', requestId);
    const start = Date.now();
    res.on('finish', () => {
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        log({
            level,
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            userId: req.user?.userId,
            message: `${req.method} ${req.path} ${res.statusCode}`,
        });
    });
    next();
}
//# sourceMappingURL=logger.js.map