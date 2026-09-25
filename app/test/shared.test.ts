import { addMonths, serviceStatus, toStoredDate } from '@renewals/shared';

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
