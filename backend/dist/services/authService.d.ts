import { JwtPayload } from '../types';
export declare function generateJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn?: string): string;
export declare function generateRefreshToken(userId: string): string;
export declare function verifyRefreshToken(token: string): {
    userId: string;
} | null;
/** SHA-256 hash a refresh token for safe storage. */
export declare function hashToken(token: string): string;
/** Expiry timestamp 7 days from now. */
export declare function refreshTokenExpiry(): Date;
export declare function generateAccountNumber(): string;
export declare function hashPassword(plain: string): Promise<string>;
export declare function verifyPassword(plain: string, hash: string): Promise<boolean>;
//# sourceMappingURL=authService.d.ts.map