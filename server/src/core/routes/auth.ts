import { Hono } from 'hono';
import { GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL, verifyOwnerIdToken } from '../auth/google';
import { authenticate } from '../auth/middleware';
import {
  createSession,
  revokeSession,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  sessionCookie,
  signCookieValue,
} from '../auth/sessions';
import { randomToken, sha256Base64url, sign, unsign } from '../crypto';
import type { Deps } from '../deps';
import { fail, parseCookies } from '../http';

const OAUTH_COOKIE = '__Host-oauth';

function oauthCookie(value: string, maxAge: number): string {
  return `${OAUTH_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Web: Google redirect flow (/auth/google/start → Google → /auth/google/callback). */
export function webAuthRoutes(deps: Deps) {
  const app = new Hono();
  const redirectUri = () => `${deps.config.appUrl}/auth/google/callback`;

  app.get('/google/start', async (c) => {
    const state = randomToken(16);
    const nonce = randomToken(16);
    const verifier = randomToken(32);
    const url = new URL(GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: deps.config.google.webClientId,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce,
      code_challenge: await sha256Base64url(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    const cookie = await sign(btoa(JSON.stringify({ state, nonce, verifier })), deps.config.sessionSecret);
    c.header('Set-Cookie', oauthCookie(cookie, 600));
    return c.redirect(url.toString(), 302);
  });

  app.get('/google/callback', async (c) => {
    const done = (path: string) => {
      c.header('Set-Cookie', oauthCookie('', 0));
      return c.redirect(path, 302);
    };
    const raw = parseCookies(c.req.header('Cookie'))[OAUTH_COOKIE];
    const unsigned = raw ? await unsign(raw, deps.config.sessionSecret) : null;
    const code = c.req.query('code');
    type Saved = { state: string; nonce: string; verifier: string };
    let saved: Saved | null;
    try {
      saved = unsigned ? (JSON.parse(atob(unsigned)) as Saved) : null;
    } catch {
      saved = null;
    }
    if (!saved || !code || c.req.query('state') !== saved.state) return done('/login?error=failed');

    let idToken: string | undefined;
    try {
      const res = await deps.fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: deps.config.google.webClientId,
          client_secret: deps.config.google.webClientSecret,
          redirect_uri: redirectUri(),
          grant_type: 'authorization_code',
          code_verifier: saved.verifier,
        }).toString(),
      });
      idToken = res.ok ? ((await res.json()) as { id_token?: string }).id_token : undefined;
    } catch (e) {
      deps.log.warn('auth.token_exchange_failed', { error: e });
    }
    if (!idToken) return done('/login?error=failed');

    const result = await verifyOwnerIdToken({
      idToken,
      audiences: [deps.config.google.webClientId],
      ownerEmail: deps.config.ownerEmail,
      jwks: deps.jwks,
      nonce: saved.nonce,
      now: deps.now(),
    });
    if (!result.ok) {
      deps.log.warn('auth.denied', { reason: result.reason, kind: 'web' });
      return done(result.reason === 'forbidden' ? '/login?error=denied' : '/login?error=failed');
    }
    const token = await createSession(deps.repo, 'web', deps.now());
    const value = await signCookieValue(token, deps.config.sessionSecret);
    deps.log.info('auth.login', { kind: 'web' });
    c.header('Set-Cookie', oauthCookie('', 0));
    c.header('Set-Cookie', sessionCookie(value, SESSION_TTL_DAYS.web * 86_400), { append: true });
    return c.redirect('/', 302);
  });

  return app;
}

/** API auth endpoints (under /api/v1/auth). */
export function apiAuthRoutes(deps: Deps) {
  const app = new Hono();

  // App: exchanges a Google ID token (from expo-auth-session) for a bearer token.
  app.post('/google', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { idToken?: unknown } | null;
    if (!body || typeof body.idToken !== 'string') return fail(c, 400, 'invalid', 'בקשה לא תקינה');
    const result = await verifyOwnerIdToken({
      idToken: body.idToken,
      audiences: [deps.config.google.androidClientId, deps.config.google.webClientId],
      ownerEmail: deps.config.ownerEmail,
      jwks: deps.jwks,
      now: deps.now(),
    });
    if (!result.ok) {
      deps.log.warn('auth.denied', { reason: result.reason, kind: 'app' });
      return result.reason === 'forbidden'
        ? fail(c, 403, 'forbidden', 'אין הרשאה')
        : fail(c, 401, 'invalid_token', 'הכניסה נכשלה');
    }
    const token = await createSession(deps.repo, 'app', deps.now());
    deps.log.info('auth.login', { kind: 'app' });
    return c.json({ token });
  });

  app.post('/logout', async (c) => {
    const auth = await authenticate(deps, c.req.raw.headers);
    if (auth) await revokeSession(deps.repo, auth.token);
    c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return c.json({ ok: true });
  });

  return app;
}
