import { describe, expect, it } from '@jest/globals';
import { decodeJwt } from 'jose';
import { testConfig } from '../../test/helpers/config.js';
import { bearerToken, signAccessToken, verifyAccessToken } from './jwt.js';

const config = testConfig();
const claims = { userId: '11111111-1111-4111-8111-111111111111', tokenVersion: 3 };

describe('access tokens', () => {
  it('round-trips the user id and token version', async () => {
    const token = await signAccessToken(claims, config);
    await expect(verifyAccessToken(token, config)).resolves.toEqual(claims);
  });

  it('sets issuer, audience and a 7-day expiry', async () => {
    const payload = decodeJwt(await signAccessToken(claims, config));
    expect(payload.iss).toBe('fieldmate-api');
    expect(payload.aud).toBe('fieldmate-mobile:test');
    const lifetimeDays = ((payload.exp ?? 0) - (payload.iat ?? 0)) / 86_400;
    expect(lifetimeDays).toBeCloseTo(7, 5);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signAccessToken(claims, testConfig({ authSecret: 'x'.repeat(40) }));
    await expect(verifyAccessToken(token, config)).resolves.toBeNull();
  });

  it('rejects a token issued for another environment', async () => {
    const stagingToken = await signAccessToken(claims, testConfig({ appEnv: 'staging' }));
    await expect(verifyAccessToken(stagingToken, config)).resolves.toBeNull();
  });

  it('rejects malformed and tampered tokens', async () => {
    await expect(verifyAccessToken('not.a.token', config)).resolves.toBeNull();
    const token = await signAccessToken(claims, config);
    await expect(verifyAccessToken(`${token}tampered`, config)).resolves.toBeNull();
  });
});

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null for missing or unsupported headers', () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
  });
});
