import { addMonths, addYears, formatDate, fromStoredDate, toStoredDate, type DateOnly } from './dates';
import { serviceTypeDef } from './serviceTypes';
import type { Cycle, Service } from './types';

/** The renewal date after `date` for a cycle (month ends handled by addMonths). */
export function advanceRenewal(date: DateOnly, cycle: Cycle, anchorDay?: number | null): DateOnly {
  if (cycle === 'monthly') return addMonths(date, 1, anchorDay);
  if (cycle === 'yearly') return addYears(date, 1, anchorDay);
  return date;
}

/** Default renewal date for a new service: today + 1 year (monthly: + 1 month). */
export function defaultRenewalDate(today: DateOnly, cycle: Cycle): DateOnly {
  return cycle === 'monthly' ? addMonths(today, 1) : addYears(today, 1);
}

export function serviceTitle(service: Pick<Service, 'type' | 'label'>): string {
  const name = serviceTypeDef(service.type).name;
  return service.label ? `${name} ${service.label}` : name;
}

export interface MarkPaidPlan {
  payment: { service_id: number; amount_agorot: number; paid_at: string; covers_until: string };
  service: { renewal_date: string; paid_until: string; archived_at: string | null };
  historyText: string;
}

/**
 * "סמן כשולם": records a payment of price_agorot, moves renewal_date forward by
 * one cycle (once = archive) and records that the renewal was paid.
 */
export function planMarkPaid(
  service: Pick<Service, 'id' | 'type' | 'label' | 'renewal_date' | 'cycle' | 'price_agorot' | 'anchor_day'>,
  now: Date,
): MarkPaidPlan {
  const current = fromStoredDate(service.renewal_date);
  const next = advanceRenewal(current, service.cycle, service.anchor_day);
  const nowIso = now.toISOString();
  const once = service.cycle === 'once';
  return {
    payment: {
      service_id: service.id,
      amount_agorot: service.price_agorot,
      paid_at: nowIso,
      covers_until: toStoredDate(next),
    },
    service: {
      renewal_date: toStoredDate(next),
      paid_until: toStoredDate(current),
      archived_at: once ? nowIso : null,
    },
    historyText: once
      ? `${serviceTitle(service)} שולם`
      : `${serviceTitle(service)} שולם, החידוש הבא ${formatDate(next)}`,
  };
}
