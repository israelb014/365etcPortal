import { API_URL } from './config';
import { getToken } from './tokenStore';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Called when the server says the session is gone (401). */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the 401 → sign-out handling (used by the login call itself). */
  noAuthRedirect?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['X-Requested-With'] = 'fetch';
    headers['Content-Type'] = 'application/json';
  }
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'network', 'אין חיבור');
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null;
  if (!res.ok) {
    if (res.status === 401 && !opts.noAuthRedirect) unauthorizedListeners.forEach((l) => l());
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'משהו השתבש');
  }
  return data as T;
}
