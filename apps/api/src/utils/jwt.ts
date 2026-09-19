import { SignJWT, jwtVerify } from 'jose';
import type { AppConfig } from '../config/env.js';

const ALGORITHM = 'HS256';
const ISSUER = 'fieldmate-api';
export const TOKEN_LIFETIME = '7d';

export type AccessTokenClaims = {
  userId: string;
  tokenVersion: number;
};

function key(config: AppConfig): Uint8Array {
  return new TextEncoder().encode(config.authSecret);
}

/** Audience is environment-specific, so a staging token is rejected by production. */
export function audience(config: AppConfig): string {
  return `fieldmate-mobile:${config.appEnv}`;
}

export function signAccessToken(claims: AccessTokenClaims, config: AppConfig): Promise<string> {
  return new SignJWT({ ver: claims.tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(audience(config))
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(key(config));
}

/** Returns the claims, or null when the token is missing, invalid or expired. */
export async function verifyAccessToken(
  token: string,
  config: AppConfig,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(config), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: audience(config),
    });
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { userId: payload.sub, tokenVersion: payload.ver };
  } catch {
    return null;
  }
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  return match?.[1]?.trim() || null;
}
