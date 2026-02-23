import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { JwtPayload } from '../types';

const BCRYPT_ROUNDS = 12;

export function generateJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn: string = '15m'): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function generateRefreshToken(userId: string): string {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) throw new Error('REFRESH_SECRET is not configured');
  return jwt.sign({ userId }, secret, { expiresIn: '7d' } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) throw new Error('REFRESH_SECRET is not configured');
  try {
    return jwt.verify(token, secret) as { userId: string };
  } catch {
    return null;
  }
}

export function generateAccountNumber(): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `SB${digits}`;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
