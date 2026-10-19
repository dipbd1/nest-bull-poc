import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export function generateRegistrationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashRegistrationCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function verifyRegistrationCode(
  code: string,
  storedHash: string,
  secret: string,
): boolean {
  const computed = Buffer.from(hashRegistrationCode(code, secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
