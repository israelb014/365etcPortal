import type { CompanySubscription, GraphUser, SubscribedSku } from '../../src/core/integrations/microsoft/graph';
import type { Harness } from './harness';

export const TENANT = 'tenant-1';
export const SKU_STD = 'sku-std';
export const SKU_BASIC = 'sku-basic';

/** An in-memory Microsoft tenant answering the Graph calls the sync makes. */
export class FakeTenant {
  skus: SubscribedSku[] = [
    { skuId: SKU_STD, skuPartNumber: 'O365_BUSINESS_PREMIUM', consumedUnits: 2, prepaidUnits: { enabled: 5 } },
    { skuId: 'sku-free', skuPartNumber: 'FLOW_FREE', consumedUnits: 3, prepaidUnits: { enabled: 10000 } },
  ];
  subscriptions: CompanySubscription[] = [
    {
      id: 'sub-1',
      skuId: SKU_STD,
      skuPartNumber: 'O365_BUSINESS_PREMIUM',
      status: 'Enabled',
      totalLicenses: 5,
      nextLifecycleDateTime: '2027-03-14T21:59:59Z',
    },
  ];
  users: GraphUser[] = [
    { id: 'u1', displayName: 'דני כהן', userPrincipalName: 'dani@cohen-law.co.il', assignedLicenses: [{ skuId: SKU_STD }] },
    { id: 'u2', displayName: 'Rina Levi', userPrincipalName: 'rina@levi.co.il', assignedLicenses: [{ skuId: SKU_STD }] },
    { id: 'u3', displayName: 'Printer', userPrincipalName: 'printer@x.co.il', assignedLicenses: [] },
  ];
  /** Statuses to answer with before the real answer (e.g. [429, 503]). */
  failures: { status: number; retryAfter?: string }[] = [];
  down = false;
  pageSize = 2;
  calls = 0;

  constructor(h: Harness) {
    h.onFetch(/^https:\/\/(login\.microsoftonline\.com|graph\.microsoft\.com)\//, (url) => this.handle(url));
  }

  setUserSkus(id: string, skus: string[]) {
    const u = this.users.find((x) => x.id === id);
    if (u) u.assignedLicenses = skus.map((skuId) => ({ skuId }));
    else throw new Error(`no user ${id}`);
    this.recount();
  }

  recount() {
    for (const sku of this.skus) {
      if (sku.prepaidUnits.enabled >= 10000) continue;
      sku.consumedUnits = this.users.filter((u) => u.assignedLicenses.some((l) => l.skuId === sku.skuId)).length;
    }
  }

  private handle(url: string): Response {
    this.calls++;
    if (this.down) return new Response('down', { status: 500 });
    const failure = this.failures.shift();
    if (failure) {
      return new Response('busy', {
        status: failure.status,
        headers: failure.retryAfter ? { 'Retry-After': failure.retryAfter } : {},
      });
    }
    if (url.startsWith('https://login.microsoftonline.com/')) {
      if (!url.includes(`/${TENANT}/`)) return Response.json({ error: 'invalid_tenant' }, { status: 400 });
      return Response.json({ access_token: 'graph-token', expires_in: 3600 });
    }
    const u = new URL(url);
    if (u.pathname === '/v1.0/subscribedSkus') return Response.json({ value: this.skus });
    if (u.pathname === '/v1.0/directory/subscriptions') return Response.json({ value: this.subscriptions });
    if (u.pathname === '/v1.0/users') {
      const skip = Number(u.searchParams.get('$skiptoken') ?? 0);
      const page = this.users.slice(skip, skip + this.pageSize);
      const more = skip + this.pageSize < this.users.length;
      return Response.json({
        value: page,
        ...(more ? { '@odata.nextLink': `https://graph.microsoft.com/v1.0/users?$skiptoken=${skip + this.pageSize}` } : {}),
      });
    }
    return new Response('not found', { status: 404 });
  }
}
