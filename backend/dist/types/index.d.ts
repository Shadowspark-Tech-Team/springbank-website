/**
 * Re-exports shared enums from @springbank/shared so that backend code can
 * import a single canonical set of values that is also used by the frontend.
 * This eliminates enum drift between layers.
 */
import { UserRole, AccountType, TransactionType, TransactionStatus } from '@springbank/shared';
export { UserRole, AccountType, TransactionType, TransactionStatus };
export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
//# sourceMappingURL=index.d.ts.map