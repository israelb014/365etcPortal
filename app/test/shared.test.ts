import {
  addMonths,
  buildHomeRows,
  isUpdateRequired,
  monthlyProfitAgorot,
  planMarkPaid,
  serviceStatus,
  toStoredDate,
  type Service,
} from '@renewals/shared';
import { parseDateInput } from '../src/ui/ServiceForm';

describe('shared logic inside the app bundle', () => {
  it('handles month ends', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('computes status', () => {
    expect(serviceStatus({ renewal_date: toStoredDate('2026-09-20'), paid_until: null }, '2026-09-25')).toBe(
      'unpaid',
    );
  });
});

const base: Service = {
  id: 1,
  client_id: 1,
  type: 'domain',
  label: 'example.co.il',
  quantity: 1,
  renewal_date: toStoredDate('2026-01-31'),
  anchor_day: 31,
  cycle: 'monthly',
  cost_agorot: 1000,
  price_agorot: 3000,
  paid_until: null,
  auto_renew: false,
  source: 'manual',
  external_ref: null,
  note: null,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('more shared logic in the app', () => {
  it('marks paid across month ends', () => {
    const feb = planMarkPaid(base, new Date('2026-01-31T10:00:00Z'));
    expect(feb.service.renewal_date).toBe('2026-02-28T00:00:00.000Z');
    const mar = planMarkPaid({ ...base, renewal_date: feb.service.renewal_date }, new Date());
    expect(mar.service.renewal_date).toBe('2026-03-31T00:00:00.000Z');
  });

  it('computes monthly profit and client order', () => {
    expect(monthlyProfitAgorot([base, { ...base, cycle: 'yearly', price_agorot: 13000, cost_agorot: 1000 }])).toBe(3000);
    const rows = buildHomeRows(
      [
        { id: 1, name: 'א', phone: null, note: null, archived_at: null, created_at: '' },
        { id: 2, name: 'ב', phone: null, note: null, archived_at: null, created_at: '' },
      ],
      [{ ...base, client_id: 2 }, { ...base, id: 2, client_id: 1, renewal_date: toStoredDate('2027-01-01') }],
      '2026-02-05',
    );
    expect(rows.map((r) => [r.client.name, r.status])).toEqual([
      ['ב', 'unpaid'],
      ['א', 'paid'],
    ]);
  });

  it('parses dates typed as dd/MM/yyyy', () => {
    expect(parseDateInput('1/10/2027')).toBe('2027-10-01');
    expect(parseDateInput('31.02.2027')).toBeNull();
  });

  it('knows when the app must update', () => {
    expect(isUpdateRequired('1.0.0', '1.0.1')).toBe(true);
  });
});
