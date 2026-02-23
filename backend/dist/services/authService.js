"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJwt = generateJwt;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.hashToken = hashToken;
exports.refreshTokenExpiry = refreshTokenExpiry;
exports.generateAccountNumber = generateAccountNumber;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const BCRYPT_ROUNDS = 12;
function generateJwt(payload, expiresIn = '15m') {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET is not configured');
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
}
function generateRefreshToken(userId) {
    const secret = process.env.REFRESH_SECRET;
    if (!secret)
        throw new Error('REFRESH_SECRET is not configured');
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: '7d' });
}
function verifyRefreshToken(token) {
    const secret = process.env.REFRESH_SECRET;
    if (!secret)
        throw new Error('REFRESH_SECRET is not configured');
    try {
        return jsonwebtoken_1.default.verify(token, secret);
    }
    catch {
        return null;
    }
}
/** SHA-256 hash a refresh token for safe storage. */
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
/** Expiry timestamp 7 days from now. */
function refreshTokenExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
function generateAccountNumber() {
    const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
    return `SB${digits}`;
}
async function hashPassword(plain) {
    return bcrypt_1.default.hash(plain, BCRYPT_ROUNDS);
}
async function verifyPassword(plain, hash) {
    return bcrypt_1.default.compare(plain, hash);
}
//# sourceMappingURL=authService.js.map