import { daysBetween, fromStoredDate, type DateOnly } from './dates';
import type { Client, Service, Status } from './types';

export const PENDING_WINDOW_DAYS = 7;

type StatusFields = Pick<Service, 'renewal_date' | 'paid_until'>;

/** Days from `today` until the renewal (negative when overdue). */
export function daysUntilRenewal(service: Pick<Service, 'renewal_date'>, today: DateOnly): number {
  return daysBetween(today, fromStoredDate(service.renewal_date));
}

/** True when the renewal on `renewal_date` has not been paid yet. */
export function isRenewalUnpaid(service: StatusFields): boolean {
  if (!service.paid_until) return true;
  return fromStoredDate(service.paid_until) < fromStoredDate(service.renewal_date);
}

/**
 * - unpaid ("לא שולם"): today > renewal_date and paid_until < renewal_date
 * - pending ("ממתין"): renewal within 7 days and not paid
 * - paid ("שולם"): everything else
 */
export function serviceStatus(service: StatusFields, today: DateOnly): Status {
  const days = daysUntilRenewal(service, today);
  const unpaid = isRenewalUnpaid(service);
  if (days < 0 && unpaid) return 'unpaid';
  if (days <= PENDING_WINDOW_DAYS && unpaid) return 'pending';
  return 'paid';
}

const RANK: Record<Status, number> = { unpaid: 0, pending: 1, paid: 2 };

export function worstStatus(statuses: Iterable<Status>): Status {
  let worst: Status = 'paid';
  for (const s of statuses) if (RANK[s] < RANK[worst]) worst = s;
  return worst;
}

export function isActive(item: { archived_at: string | null }): boolean {
  return item.archived_at === null;
}

export interface ClientRow {
  client: Client;
  services: Service[];
  status: Status;
  /** Days until the nearest renewal among active services, or null. */
  nextRenewalDays: number | null;
  types: string[];
}

/** A client's status = the worst status among its active services. */
export function buildClientRow(client: Client, allServices: Service[], today: DateOnly): ClientRow {
  const services = allServices.filter((s) => s.client_id === client.id && isActive(s));
  const status = worstStatus(services.map((s) => serviceStatus(s, today)));
  let nextRenewalDays: number | null = null;
  for (const s of services) {
    const d = daysUntilRenewal(s, today);
    if (nextRenewalDays === null || d < nextRenewalDays) nextRenewalDays = d;
  }
  const types = [...new Set(services.map((s) => s.type))];
  return { client, services, status, nextRenewalDays, types };
}

/** Home list order: unpaid → pending → paid, then nearest renewal, then name. */
export function sortClientRows(rows: ClientRow[]): ClientRow[] {
  return [...rows].sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    const da = a.nextRenewalDays ?? Number.POSITIVE_INFINITY;
    const db = b.nextRenewalDays ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.client.name.localeCompare(b.client.name, 'he');
  });
}

export function buildHomeRows(clients: Client[], services: Service[], today: DateOnly): ClientRow[] {
  return sortClientRows(clients.filter(isActive).map((c) => buildClientRow(c, services, today)));
}

export interface HomeStats {
  renewalsThisWeek: number;
  unpaidClients: number;
  monthlyProfitAgorot: number;
}

export function renewalText(days: number | null): string {
  if (days === null) return 'אין שירותים';
  if (days === 0) return 'חידוש היום';
  if (days === 1) return 'חידוש מחר';
  if (days < 0) return days === -1 ? 'עבר יום מהחידוש' : `עברו ${-days} ימים מהחידוש`;
  return `חידוש בעוד ${days} ימים`;
}
