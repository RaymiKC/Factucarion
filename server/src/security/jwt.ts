import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  companyIds: string[];
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string') return null;
    return decoded as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

export type ChangeScope = 'password_change' | 'password_reset';

export interface ChangeTokenPayload {
  sub: string;
  scope: ChangeScope;
}

/** Short lived token that only allows completing a password change. */
export function signChangeToken(userId: string, scope: ChangeScope): string {
  return jwt.sign({ sub: userId, scope }, config.jwtSecret, { expiresIn: '20m' });
}

export function verifyChangeToken(token: string): ChangeTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string') return null;
    const payload = decoded as unknown as ChangeTokenPayload;
    if (!payload.sub || !payload.scope) return null;
    return payload;
  } catch {
    return null;
  }
}
