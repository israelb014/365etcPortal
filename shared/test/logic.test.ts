import { describe, expect, it } from 'vitest';
import {
  buildHomeRows,
  compareVersions,
  formatMoney,
  isUpdateRequired,
  monthlyProfitAgorot,
  parseMoney,
  planMarkPaid,
  serviceStatus,
  toStoredDate,
  type Client,
  type Service,
} from '../src';

const TODAY = '2026-09-25';

function svc(over: Partial<Service> = {}): Service {
  return {
    id: 1,
    client_id: 1,
    type: 'antivirus',
    label: 'ESET',
    quantity: 1,
    renewal_date: toStoredDate('2026-12-01'),
    anchor_day: null,
    cycle: 'yearly',
    cost_agorot: 10000,
    price_agorot: 22000,
    paid_until: null,
    auto_renew: false,
    source: 'manual',
    external_ref: null,
    note: null,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function client(id: number, name: string): Client {
  return { id, name, phone: null, note: null, archived_at: null, created_at: '2026-01-01T00:00:00.000Z' };
}

describe('service status', () => {
  it('is unpaid after the renewal date when not paid', () => {
    expect(serviceStatus(svc({ renewal_date: toStoredDate('2026-09-24') }), TODAY)).toBe('unpaid');
  });

  it('is pending within 7 days (inclusive) and on the renewal day', () => {
    expect(serviceStatus(svc({ renewal_date: toStoredDate('2026-10-02') }), TODAY)).toBe('pending');
    expect(serviceStatus(svc({ renewal_date: toStoredDate(TODAY) }), TODAY)).toBe('pending');
    expect(serviceStatus(svc({ renewal_date: toStoredDate('2026-10-03') }), TODAY)).toBe('paid');
  });

  it('is paid when paid_until reaches the renewal date', () => {
    const date = toStoredDate('2026-09-20');
    expect(serviceStatus(svc({ renewal_date: date, paid_until: date }), TODAY)).toBe('paid');
    expect(
      serviceStatus(svc({ renewal_date: date, paid_until: toStoredDate('2025-09-20') }), TODAY),
    ).toBe('unpaid');
  });
});

describe('home rows', () => {
  it('orders unpaid → pending → paid, then nearest renewal; client = worst service', () => {
    const clients = [client(1, 'א'), client(2, 'ב'), client(3, 'ג'), client(4, 'ד')];
    const services = [
      svc({ id: 1, client_id: 1, renewal_date: toStoredDate('2027-01-01') }),
      svc({ id: 2, client_id: 2, renewal_date: toStoredDate('2026-09-27') }),
      svc({ id: 3, client_id: 3, renewal_date: toStoredDate('2026-12-01') }),
      svc({ id: 4, client_id: 3, renewal_date: toStoredDate('2026-09-01') }),
      svc({ id: 5, client_id: 4, renewal_date: toStoredDate('2026-11-01') }),
    ];
    const rows = buildHomeRows(clients, services, TODAY);
    expect(rows.map((r) => [r.client.id, r.status])).toEqual([
      [3, 'unpaid'],
      [2, 'pending'],
      [4, 'paid'],
      [1, 'paid'],
    ]);
  });

  it('ignores archived services and clients', () => {
    const clients = [client(1, 'א'), { ...client(2, 'ב'), archived_at: '2026-01-01T00:00:00.000Z' }];
    const services = [svc({ renewal_date: toStoredDate('2026-01-01'), archived_at: '2026-02-01T00:00:00.000Z' })];
    const rows = buildHomeRows(clients, services, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('paid');
    expect(rows[0]!.nextRenewalDays).toBeNull();
  });
});

describe('mark paid', () => {
  const now = new Date('2026-09-25T10:00:00Z');

  it('moves a yearly renewal one year and records the payment', () => {
    const plan = planMarkPaid(svc({ renewal_date: toStoredDate('2026-09-30') }), now);
    expect(plan.payment.amount_agorot).toBe(22000);
    expect(plan.service.renewal_date).toBe('2027-09-30T00:00:00.000Z');
    expect(plan.service.paid_until).toBe('2026-09-30T00:00:00.000Z');
    expect(plan.payment.covers_until).toBe('2027-09-30T00:00:00.000Z');
    expect(plan.service.archived_at).toBeNull();
  });

  it('handles month ends for monthly services', () => {
    const plan = planMarkPaid(svc({ cycle: 'monthly', renewal_date: toStoredDate('2026-01-31') }), now);
    expect(plan.service.renewal_date).toBe('2026-02-28T00:00:00.000Z');
    const leap = planMarkPaid(svc({ cycle: 'monthly', renewal_date: toStoredDate('2028-01-31') }), now);
    expect(leap.service.renewal_date).toBe('2028-02-29T00:00:00.000Z');
    const anchored = planMarkPaid(
      svc({ cycle: 'monthly', renewal_date: toStoredDate('2026-02-28'), anchor_day: 31 }),
      now,
    );
    expect(anchored.service.renewal_date).toBe('2026-03-31T00:00:00.000Z');
  });

  it('archives one-time services', () => {
    const plan = planMarkPaid(svc({ cycle: 'once' }), now);
    expect(plan.service.archived_at).toBe(now.toISOString());
  });

  it('turns an unpaid service into paid', () => {
    const s = svc({ renewal_date: toStoredDate('2026-09-20') });
    expect(serviceStatus(s, TODAY)).toBe('unpaid');
    const plan = planMarkPaid(s, now);
    expect(serviceStatus({ ...s, ...plan.service }, TODAY)).toBe('paid');
    // …and the next renewal becomes pending again a week before it.
    expect(serviceStatus({ ...s, ...plan.service }, '2027-09-14')).toBe('pending');
  });
});

describe('monthly profit', () => {
  it('normalizes yearly, multiplies quantity and excludes once/archived', () => {
    const services = [
      svc({ cycle: 'yearly', price_agorot: 120000, cost_agorot: 60000, quantity: 2 }),
      svc({ cycle: 'monthly', price_agorot: 5000, cost_agorot: 3000, quantity: 3 }),
      svc({ cycle: 'once', price_agorot: 99999, cost_agorot: 0 }),
      svc({ cycle: 'monthly', price_agorot: 99999, archived_at: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(monthlyProfitAgorot(services)).toBe(10000 + 6000);
  });
});

describe('money and versions', () => {
  it('formats and parses agorot', () => {
    expect(formatMoney(123456)).toBe('₪1,234.56');
    expect(formatMoney(100000)).toBe('₪1,000');
    expect(parseMoney('1,250.5')).toBe(125050);
    expect(parseMoney('abc')).toBeNull();
  });

  it('compares versions', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(isUpdateRequired('1.0.0', '1.1.0')).toBe(true);
    expect(isUpdateRequired('1.1.0', '1.1.0')).toBe(false);
  });
});
