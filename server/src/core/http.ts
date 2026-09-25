import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // react-native-web writes component styles at runtime.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

/** Adds the security headers to every response (API, redirects and static files). */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  // Static asset responses may be immutable; copy them before editing headers.
  const res = new Response(c.res.body, c.res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  c.res = res;
};

/** Mutations must carry `X-Requested-With: fetch` (blocks cross-site form posts). */
export const requireFetchHeader: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (c.req.header('X-Requested-With') !== 'fetch') {
      return fail(c, 403, 'bad_request_origin', 'הבקשה נחסמה');
    }
  }
  await next();
};

export function fail(c: Context, status: ContentfulStatusCode, error: string, message: string) {
  return c.json({ error, message }, status);
}

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
