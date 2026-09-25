/** Minimal Microsoft Graph client (app-only, client credentials). Uses the injected fetch. */

export const GRAPH = 'https://graph.microsoft.com/v1.0';
const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 30_000;

export class GraphError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface GraphCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface SubscribedSku {
  skuId: string;
  skuPartNumber: string;
  capabilityStatus?: string;
  consumedUnits: number;
  prepaidUnits: { enabled: number; suspended?: number; warning?: number };
}

export interface CompanySubscription {
  id: string;
  skuId: string;
  skuPartNumber: string;
  status: string;
  totalLicenses: number;
  nextLifecycleDateTime: string | null;
}

export interface GraphUser {
  id: string;
  displayName: string | null;
  userPrincipalName: string;
  assignedLicenses: { skuId: string }[];
}

export interface GraphData {
  skus: SubscribedSku[];
  subscriptions: CompanySubscription[];
  users: GraphUser[];
}

function retryDelayMs(res: Response): number {
  const header = res.headers.get('Retry-After');
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_WAIT_MS);
  const date = header ? Date.parse(header) : NaN;
  if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), MAX_WAIT_MS);
  return 2_000;
}

export class GraphClient {
  /** One token request per sync, shared by the parallel Graph calls. */
  private token: Promise<string> | null = null;

  constructor(
    private readonly creds: GraphCredentials,
    private readonly fetchFn: typeof fetch,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  /** 429 / 503: wait for Retry-After and try again, at most 3 attempts in total. */
  private async request(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const res = await this.fetchFn(url, init);
      if ((res.status === 429 || res.status === 503) && attempt < MAX_ATTEMPTS) {
        await this.sleep(retryDelayMs(res));
        continue;
      }
      return res;
    }
  }

  private accessToken(): Promise<string> {
    this.token ??= this.requestToken();
    return this.token;
  }

  private async requestToken(): Promise<string> {
    const res = await this.request(
      `https://login.microsoftonline.com/${encodeURIComponent(this.creds.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.creds.clientId,
          client_secret: this.creds.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }).toString(),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
    if (!res.ok || !json.access_token) throw new GraphError(res.status, `token: ${json.error ?? res.status}`);
    return json.access_token;
  }

  async get<T>(url: string): Promise<T> {
    const token = await this.accessToken();
    const res = await this.request(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!res.ok) throw new GraphError(res.status, `GET ${new URL(url).pathname}: ${res.status}`);
    return (await res.json()) as T;
  }

  /** Follows @odata.nextLink until the last page. */
  async getAll<T>(url: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = url;
    for (let page = 0; next && page < 100; page++) {
      const body: { value: T[]; '@odata.nextLink'?: string } = await this.get(next);
      items.push(...body.value);
      next = body['@odata.nextLink'];
    }
    return items;
  }

  async fetchAll(): Promise<GraphData> {
    const [skus, subscriptions, users] = await Promise.all([
      this.getAll<SubscribedSku>(`${GRAPH}/subscribedSkus`),
      this.getAll<CompanySubscription>(`${GRAPH}/directory/subscriptions`),
      this.getAll<GraphUser>(
        `${GRAPH}/users?$select=id,displayName,userPrincipalName,assignedLicenses&$top=999`,
      ),
    ]);
    return { skus, subscriptions, users };
  }
}
