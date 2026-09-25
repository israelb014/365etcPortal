import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { createApp } from '../../src/core/app';
import { createIntegrations } from '../../src/core/integrations';
import type { Config } from '../../src/core/config';
import type { Deps } from '../../src/core/deps';
import { silentLogger } from '../../src/core/log';
import type { PushMessage, PushResult, PushSender } from '../../src/core/notifications/push';
import { createRepo } from '../../src/core/repo';
import { createTestDb } from './sqliteDb';

export const OWNER = 'owner@example.com';
export const WEB_CLIENT = 'web-client.apps.googleusercontent.com';
export const ANDROID_CLIENT = 'android-client.apps.googleusercontent.com';

export const testConfig: Config = {
  appUrl: 'https://renewals.test',
  ownerEmail: OWNER,
  sessionSecret: 'x'.repeat(48),
  google: { webClientId: WEB_CLIENT, webClientSecret: 'secret', androidClientId: ANDROID_CLIENT },
  minAppVersion: '1.0.0',
  apkUrl: 'https://renewals.test/app.apk',
  expoAccessToken: null,
  microsoft: null,
};

type FetchHandler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

export class FakePush implements PushSender {
  sent: PushMessage[] = [];
  invalid = new Set<string>();
  failNext = false;
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('network down');
    }
    this.sent.push(...messages);
    return messages.map((m) => ({
      token: m.to,
      ok: !this.invalid.has(m.to),
      invalidToken: this.invalid.has(m.to),
    }));
  }
}

let keys: { privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']; jwk: JWK } | null = null;

async function signingKeys() {
  if (!keys) {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256', use: 'sig' };
    keys = { privateKey, jwk };
  }
  return keys;
}

export const START = new Date('2026-09-25T08:00:00.000Z');

export async function googleIdToken(
  claims: Record<string, unknown>,
  opts: { aud?: string; iss?: string; at?: Date } = {},
) {
  const at = Math.floor((opts.at ?? START).getTime() / 1000);
  const { privateKey } = await signingKeys();
  return new SignJWT({ email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(opts.iss ?? 'https://accounts.google.com')
    .setAudience(opts.aud ?? ANDROID_CLIENT)
    .setSubject('123')
    .setIssuedAt(at)
    .setExpirationTime(at + 3600)
    .sign(privateKey);
}

export async function createHarness(overrides: Partial<Config> = {}) {
  const { jwk } = await signingKeys();
  const db = createTestDb();
  const repo = createRepo(db);
  const push = new FakePush();
  const clock = { now: new Date(START) };
  const routes: { match: (url: string) => boolean; handler: FetchHandler }[] = [];
  const fetchLog: string[] = [];
  const sleeps: number[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchLog.push(`${init?.method ?? 'GET'} ${url}`);
    const route = routes.find((r) => r.match(url));
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    return route.handler(url, init);
  }) as typeof fetch;

  const deps: Deps = {
    repo,
    config: { ...testConfig, ...overrides },
    log: silentLogger,
    now: () => new Date(clock.now),
    jwks: createLocalJWKSet({ keys: [jwk] }),
    fetch: fakeFetch,
    push,
    integrations: [],
    sleep: async (ms) => void sleeps.push(ms),
  };
  deps.integrations = createIntegrations(deps);
  const app = createApp(deps);

  let bearer: string | null = null;
  const request = (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== 'GET' && !headers.has('X-Requested-With')) {
      headers.set('X-Requested-With', 'fetch');
    }
    if (bearer && !headers.has('Authorization') && !headers.has('Cookie')) {
      headers.set('Authorization', `Bearer ${bearer}`);
    }
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(init.json);
    }
    return app.request(path, { ...init, headers, body });
  };

  return {
    deps,
    db,
    repo,
    push,
    clock,
    app,
    request,
    fetchLog,
    sleeps,
    onFetch(match: string | RegExp, handler: FetchHandler) {
      routes.unshift({
        match: (url) => (typeof match === 'string' ? url.startsWith(match) : match.test(url)),
        handler,
      });
    },
    /** Logs in through the app endpoint and uses the bearer token for later requests. */
    async login() {
      const res = await request('/api/v1/auth/google', {
        method: 'POST',
        json: { idToken: await googleIdToken({ email: OWNER }) },
      });
      if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
      bearer = ((await res.json()) as { token: string }).token;
      return bearer;
    },
    setBearer(token: string | null) {
      bearer = token;
    },
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;
