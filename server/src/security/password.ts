import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$/.test(stored);
}

export function sha256(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/**
 * Verifies a clear text password. Supports bcrypt hashes and the legacy
 * SHA-256 hex hashes produced by the old browser side implementation so
 * existing installations keep working after the migration.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return sha256(plain) === stored.toLowerCase();
  }
  return false;
}

export function generateTempPassword(length = 15): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

export function generateOtp(length = 6): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += String(bytes[i] % 10);
  }
  return result;
}
