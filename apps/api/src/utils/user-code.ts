import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Six digits: easy to type from an email, and safe given expiry plus the attempt limit. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Keyed with AUTH_SECRET, so a leaked table cannot be brute-forced offline in a million tries. */
export function hashCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function codeMatches(storedHash: string, code: string, secret: string): boolean {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashCode(code, secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
