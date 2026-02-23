"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
/**
 * Application-level Prisma middleware that enforces AuditLog immutability at
 * the ORM layer — independently of route-level 405 guards.
 *
 * Any attempt to call delete, deleteMany, update, or updateMany on the
 * auditLog model will throw an error, preventing both accidental code bugs
 * and any bypassed route from mutating the compliance record.
 */
const AUDIT_LOG_BLOCKED_OPERATIONS = new Set([
    'delete',
    'deleteMany',
    'update',
    'updateMany',
    'upsert',
]);
const prisma = new client_1.PrismaClient().$extends({
    query: {
        auditLog: {
            $allOperations({ operation, args: _args, query }) {
                if (AUDIT_LOG_BLOCKED_OPERATIONS.has(operation)) {
                    throw new Error(`AuditLog records are immutable. Operation "${operation}" is not permitted.`);
                }
                return query(_args);
            },
        },
    },
});
exports.default = prisma;
//# sourceMappingURL=db.js.map