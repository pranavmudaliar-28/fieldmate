import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

const OPTIONS = { type: argon2.argon2id } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed stored hash must not leak as a 500.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real verification when the email is unknown,
 * so response timing does not reveal which accounts exist.
 */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  dummyHash ??= argon2.hash(randomBytes(32).toString('hex'), OPTIONS);
  await verifyPassword(await dummyHash, password);
}
