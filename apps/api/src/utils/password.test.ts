import { describe, expect, it } from '@jest/globals';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('produces an argon2id hash that is not the password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse battery');
  });

  it('uses a random salt, so the same password hashes differently', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword(hash, 's3cret-password')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'S3cret-password')).resolves.toBe(false);
    await expect(verifyPassword(hash, '')).resolves.toBe(false);
  });

  it('returns false for a malformed stored hash instead of throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('dummy verification completes without throwing', async () => {
    await expect(verifyAgainstDummyHash('anything')).resolves.toBeUndefined();
  });
});
