import { randomToken, sha256Hex, sign, unsign } from '../crypto';
import type { Repo, SessionRow } from '../repo';

export type SessionKind = 'web' | 'app';

const DAY_MS = 86_400_000;
export const SESSION_TTL_DAYS: Record<SessionKind, number> = { web: 30, app: 90 };
/** Sliding expiry is refreshed at most this often, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const SESSION_COOKIE = '__Host-session';

export interface ActiveSession {
  session: SessionRow;
  /** Raw token, needed to re-issue the web cookie on refresh. */
  token: string;
  refreshed: boolean;
}

export async function createSession(repo: Repo, kind: SessionKind, now: Date): Promise<string> {
  const token = randomToken(32);
  const iso = now.toISOString();
  await repo.sessions.create({
    token_hash: await sha256Hex(token),
    kind,
    created_at: iso,
    last_seen_at: iso,
    expires_at: new Date(now.getTime() + SESSION_TTL_DAYS[kind] * DAY_MS).toISOString(),
  });
  return token;
}

/** Looks up a session, rejecting expired ones and sliding the expiry forward. */
export async function resolveSession(
  repo: Repo,
  token: string,
  kind: SessionKind,
  now: Date,
): Promise<ActiveSession | null> {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const session = await repo.sessions.findByHash(hash);
  if (!session || session.kind !== kind) return null;
  if (new Date(session.expires_at) <= now) {
    await repo.sessions.deleteByHash(hash);
    return null;
  }
  let refreshed = false;
  if (now.getTime() - new Date(session.last_seen_at).getTime() >= TOUCH_INTERVAL_MS) {
    const expires = new Date(now.getTime() + SESSION_TTL_DAYS[kind] * DAY_MS).toISOString();
    await repo.sessions.touch(session.id, now.toISOString(), expires);
    session.last_seen_at = now.toISOString();
    session.expires_at = expires;
    refreshed = true;
  }
  return { session, token, refreshed };
}

export async function revokeSession(repo: Repo, token: string): Promise<void> {
  await repo.sessions.deleteByHash(await sha256Hex(token));
}

export function signCookieValue(token: string, secret: string): Promise<string> {
  return sign(token, secret);
}

export function readCookieValue(value: string, secret: string): Promise<string | null> {
  return unsign(value, secret);
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
