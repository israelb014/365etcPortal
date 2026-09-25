import type { Client } from '@renewals/shared';

/** Name similarity for "למי שייך?" suggestions (bigram Dice on normalized tokens). */

const FINAL_LETTERS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const STOP = new Set(['com', 'co', 'il', 'org', 'net', 'onmicrosoft', 'www', 'בע"מ', 'בעמ', 'ltd', 'inc']);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

export function dice(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.length === 0 || B.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const x of A) counts.set(x, (counts.get(x) ?? 0) + 1);
  let hits = 0;
  for (const x of B) {
    const c = counts.get(x) ?? 0;
    if (c > 0) {
      hits++;
      counts.set(x, c - 1);
    }
  }
  return (2 * hits) / (A.length + B.length);
}

export function similarity(user: { display_name: string; upn: string }, clientName: string): number {
  const [local = '', domain = ''] = user.upn.split('@');
  const userTokens = [...tokens(user.display_name), ...tokens(local), ...tokens(domain.split('.')[0] ?? '')];
  const clientTokens = tokens(clientName);
  let best = 0;
  for (const u of userTokens) {
    for (const c of clientTokens) {
      const score = u.includes(c) || c.includes(u) ? Math.max(0.8, dice(u, c)) : dice(u, c);
      best = Math.max(best, score);
    }
  }
  return best;
}

export function suggestClients(
  user: { display_name: string; upn: string },
  clients: Client[],
  limit = 3,
  minScore = 0.4,
): Client[] {
  return clients
    .map((c) => ({ c, score: similarity(user, c.name) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
