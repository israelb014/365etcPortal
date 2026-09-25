import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../src/core/http';
import { createHarness, googleIdToken, OWNER, WEB_CLIENT } from './helpers/harness';

async function appLogin(h: Awaited<ReturnType<typeof createHarness>>, idToken: string) {
  return h.request('/api/v1/auth/google', { method: 'POST', json: { idToken } });
}

describe('app login (Google ID token → bearer)', () => {
  it('lets the owner in', async () => {
    const h = await createHarness();
    const res = await appLogin(h, await googleIdToken({ email: OWNER }));
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    h.setBearer(token);
    expect((await h.request('/api/v1/me')).status).toBe(200);
  });

  it('accepts the owner email case-insensitively', async () => {
    const h = await createHarness();
    expect((await appLogin(h, await googleIdToken({ email: 'Owner@Example.com' }))).status).toBe(200);
  });

  it('refuses anyone else with "אין הרשאה"', async () => {
    const h = await createHarness();
    const res = await appLogin(h, await googleIdToken({ email: 'someone@example.com' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden', message: 'אין הרשאה' });
  });

  it('refuses an unverified owner email', async () => {
    const h = await createHarness();
    const res = await appLogin(h, await googleIdToken({ email: OWNER, email_verified: false }));
    expect(res.status).toBe(403);
  });

  it('refuses tokens for another app, another issuer or expired', async () => {
    const h = await createHarness();
    expect((await appLogin(h, await googleIdToken({ email: OWNER }, { aud: 'other' }))).status).toBe(401);
    expect(
      (await appLogin(h, await googleIdToken({ email: OWNER }, { iss: 'https://evil.example' }))).status,
    ).toBe(401);
    const old = await googleIdToken({ email: OWNER }, { at: new Date('2026-09-24T00:00:00Z') });
    expect((await appLogin(h, old)).status).toBe(401);
    expect((await appLogin(h, 'not-a-jwt')).status).toBe(401);
  });

  it('stores only a hash of the token', async () => {
    const h = await createHarness();
    const token = await h.login();
    const rows = await h.db.all<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toContain(token);
    expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('sessions', () => {
  it('requires a session for the API', async () => {
    const h = await createHarness();
    expect((await h.request('/api/v1/me')).status).toBe(401);
    h.setBearer('made-up');
    expect((await h.request('/api/v1/me')).status).toBe(401);
  });

  it('app sessions slide for 90 days', async () => {
    const h = await createHarness();
    await h.login();
    h.clock.now = new Date(h.clock.now.getTime() + 80 * 86_400_000);
    expect((await h.request('/api/v1/me')).status).toBe(200); // refreshes expiry
    h.clock.now = new Date(h.clock.now.getTime() + 80 * 86_400_000);
    expect((await h.request('/api/v1/me')).status).toBe(200);
    h.clock.now = new Date(h.clock.now.getTime() + 91 * 86_400_000);
    expect((await h.request('/api/v1/me')).status).toBe(401);
  });

  it('log out revokes the session', async () => {
    const h = await createHarness();
    await h.login();
    expect((await h.request('/api/v1/auth/logout', { method: 'POST' })).status).toBe(200);
    expect((await h.request('/api/v1/me')).status).toBe(401);
  });

  it('mutations require X-Requested-With: fetch', async () => {
    const h = await createHarness();
    const res = await h.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(403);
  });
});

describe('web login (redirect flow + signed cookie)', () => {
  async function startFlow(h: Awaited<ReturnType<typeof createHarness>>) {
    const start = await h.request('/auth/google/start');
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get('Location')!);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe(WEB_CLIENT);
    expect(location.searchParams.get('redirect_uri')).toBe('https://renewals.test/auth/google/callback');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    const cookie = start.headers.get('Set-Cookie')!.split(';')[0]!;
    return {
      cookie,
      state: location.searchParams.get('state')!,
      nonce: location.searchParams.get('nonce')!,
    };
  }

  it('signs the owner in with an HttpOnly Secure SameSite=Lax cookie', async () => {
    const h = await createHarness();
    const { cookie, state, nonce } = await startFlow(h);
    const idToken = await googleIdToken({ email: OWNER, nonce }, { aud: WEB_CLIENT });
    h.onFetch('https://oauth2.googleapis.com/token', () => Response.json({ id_token: idToken }));
    const cb = await h.request(`/auth/google/callback?code=abc&state=${state}`, { headers: { Cookie: cookie } });
    expect(cb.status).toBe(302);
    expect(cb.headers.get('Location')).toBe('/');
    const setCookie = cb.headers.getSetCookie().find((c) => c.startsWith('__Host-session='))!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Max-Age=2592000/);

    const session = setCookie.split(';')[0]!;
    expect((await h.request('/api/v1/me', { headers: { Cookie: session } })).status).toBe(200);
    // A tampered cookie is rejected.
    expect((await h.request('/api/v1/me', { headers: { Cookie: `${session}x` } })).status).toBe(401);
  });

  it('sends anyone else back to login with "denied"', async () => {
    const h = await createHarness();
    const { cookie, state, nonce } = await startFlow(h);
    const idToken = await googleIdToken({ email: 'intruder@example.com', nonce }, { aud: WEB_CLIENT });
    h.onFetch('https://oauth2.googleapis.com/token', () => Response.json({ id_token: idToken }));
    const cb = await h.request(`/auth/google/callback?code=abc&state=${state}`, { headers: { Cookie: cookie } });
    expect(cb.headers.get('Location')).toBe('/login?error=denied');
    expect(await h.db.all('SELECT * FROM sessions')).toHaveLength(0);
  });

  it('rejects a wrong state or nonce', async () => {
    const h = await createHarness();
    const { cookie, state } = await startFlow(h);
    const idToken = await googleIdToken({ email: OWNER, nonce: 'wrong' }, { aud: WEB_CLIENT });
    h.onFetch('https://oauth2.googleapis.com/token', () => Response.json({ id_token: idToken }));
    const badState = await h.request('/auth/google/callback?code=abc&state=zzz', { headers: { Cookie: cookie } });
    expect(badState.headers.get('Location')).toBe('/login?error=failed');
    const badNonce = await h.request(`/auth/google/callback?code=abc&state=${state}`, {
      headers: { Cookie: cookie },
    });
    expect(badNonce.headers.get('Location')).toBe('/login?error=failed');
  });
});

describe('security headers', () => {
  it('are on every response', async () => {
    const h = await createHarness();
    for (const path of ['/api/version', '/api/v1/me', '/auth/google/start', '/some/page']) {
      const res = await h.request(path);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(k)).toBe(v);
    }
    const res = await h.request('/api/version');
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
