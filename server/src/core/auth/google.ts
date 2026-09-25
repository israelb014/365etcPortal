import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let remoteJwks: JWTVerifyGetKey | null = null;

/** Google's signing keys (cached per isolate by jose). */
export function googleJwks(): JWTVerifyGetKey {
  remoteJwks ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  return remoteJwks;
}

export type LoginResult = { ok: true; email: string } | { ok: false; reason: 'invalid' | 'forbidden' };

/**
 * Validates a Google ID token and checks that it belongs to the owner.
 * Only `ownerEmail` (verified by Google) may sign in.
 */
export async function verifyOwnerIdToken(opts: {
  idToken: string;
  audiences: string[];
  ownerEmail: string;
  jwks: JWTVerifyGetKey;
  nonce?: string;
  now?: Date;
}): Promise<LoginResult> {
  const audiences = opts.audiences.filter(Boolean);
  if (!opts.ownerEmail || audiences.length === 0) return { ok: false, reason: 'invalid' };
  let payload;
  try {
    ({ payload } = await jwtVerify(opts.idToken, opts.jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: audiences,
      algorithms: ['RS256'],
      currentDate: opts.now,
    }));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (opts.nonce !== undefined && payload.nonce !== opts.nonce) return { ok: false, reason: 'invalid' };
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (payload.email_verified !== true || email !== opts.ownerEmail.toLowerCase()) {
    return { ok: false, reason: 'forbidden' };
  }
  return { ok: true, email };
}
