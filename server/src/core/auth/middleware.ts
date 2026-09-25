import type { MiddlewareHandler } from 'hono';
import type { Deps } from '../deps';
import { fail, parseCookies } from '../http';
import {
  readCookieValue,
  resolveSession,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  sessionCookie,
  signCookieValue,
  type ActiveSession,
} from './sessions';

export type AuthVars = { auth: ActiveSession };

/** Resolves the bearer token (app) or the signed cookie (web). */
export async function authenticate(deps: Deps, headers: Headers): Promise<ActiveSession | null> {
  const now = deps.now();
  const authz = headers.get('Authorization');
  if (authz?.startsWith('Bearer ')) {
    return resolveSession(deps.repo, authz.slice(7).trim(), 'app', now);
  }
  const cookie = parseCookies(headers.get('Cookie') ?? undefined)[SESSION_COOKIE];
  if (!cookie) return null;
  const token = await readCookieValue(cookie, deps.config.sessionSecret);
  if (!token) return null;
  return resolveSession(deps.repo, token, 'web', now);
}

export function requireAuth(deps: Deps): MiddlewareHandler<{ Variables: AuthVars }> {
  return async (c, next) => {
    const auth = await authenticate(deps, c.req.raw.headers);
    if (!auth) return fail(c, 401, 'unauthorized', 'צריך להתחבר מחדש');
    c.set('auth', auth);
    await next();
    if (auth.refreshed && auth.session.kind === 'web') {
      const value = await signCookieValue(auth.token, deps.config.sessionSecret);
      c.res.headers.append('Set-Cookie', sessionCookie(value, SESSION_TTL_DAYS.web * 86_400));
    }
  };
}
