import { describe, expect, it } from '@jest/globals';
import { codeMatches, generateCode, hashCode } from './user-code.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('user codes', () => {
  it('generates six digits, keeping leading zeros', () => {
    for (let i = 0; i < 200; i += 1) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('matches only the code that was hashed, under the same secret', () => {
    const hash = hashCode('042917', SECRET);
    expect(codeMatches(hash, '042917', SECRET)).toBe(true);
    expect(codeMatches(hash, '042918', SECRET)).toBe(false);
    expect(codeMatches(hash, '042917', `${SECRET}x`)).toBe(false);
  });
});
