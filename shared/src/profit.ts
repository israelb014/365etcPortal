import { isActive } from './status';
import type { Service } from './types';

/**
 * Monthly profit = Σ active services' (price − cost) × quantity, normalized to a
 * month (yearly ÷ 12; one-time services excluded). Rounded to whole agorot.
 */
export function monthlyProfitAgorot(services: Service[]): number {
  let total = 0;
  for (const s of services) {
    if (!isActive(s) || s.cycle === 'once') continue;
    const margin = (s.price_agorot - s.cost_agorot) * s.quantity;
    total += s.cycle === 'yearly' ? margin / 12 : margin;
  }
  return Math.round(total);
}
