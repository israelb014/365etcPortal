import {
  fromStoredDate,
  planMarkPaid,
  serviceTitle,
  serviceTypeDef,
  splitDate,
  toStoredDate,
  type Client,
  type Cycle,
  type Payment,
  type Service,
} from '@renewals/shared';
import type { Deps } from './deps';
import { HttpError } from './http';
import type { NewService, ServicePatch } from './repo';

/** Domain operations shared by the API, the notification action and integrations. */

export function notFound(): never {
  throw new HttpError(404, 'not_found', 'לא נמצא');
}

export async function createClient(
  deps: Deps,
  input: { name: string; phone?: string | null; note?: string | null },
): Promise<Client> {
  const now = deps.now().toISOString();
  const client = await deps.repo.clients.create(
    { name: input.name, phone: input.phone ?? null, note: input.note ?? null },
    now,
  );
  await deps.repo.history.add({ client_id: client.id, service_id: null, text: 'לקוח נוסף', created_at: now });
  return client;
}

export async function archiveClient(deps: Deps, clientId: number): Promise<void> {
  const client = await deps.repo.clients.get(clientId);
  if (!client) notFound();
  if (client.archived_at) return;
  const now = deps.now().toISOString();
  const services = await deps.repo.services.listForClient(clientId);
  await deps.repo.db.batch([
    { sql: 'UPDATE clients SET archived_at = ? WHERE id = ?', params: [now, clientId] },
    ...services.map((s) => deps.repo.services.updateStatement(s.id, { archived_at: now })!),
    deps.repo.history.insertStatement({ client_id: clientId, service_id: null, text: 'הלקוח הועבר לארכיון', created_at: now }),
  ]);
}

export interface ServiceFields {
  type: string;
  label?: string | null;
  quantity?: number;
  /** YYYY-MM-DD */
  renewal_date: string;
  cycle?: Cycle;
  cost_agorot?: number;
  price_agorot?: number;
  auto_renew?: boolean;
  note?: string | null;
}

export async function createService(
  deps: Deps,
  clientId: number,
  fields: ServiceFields,
  extra: Partial<Pick<NewService, 'source' | 'external_ref' | 'paid_until'>> = {},
): Promise<Service> {
  const client = await deps.repo.clients.get(clientId);
  if (!client || client.archived_at) notFound();
  const now = deps.now().toISOString();
  const service = await deps.repo.services.create(
    {
      client_id: clientId,
      type: fields.type,
      label: fields.label ?? null,
      quantity: fields.quantity ?? 1,
      renewal_date: toStoredDate(fields.renewal_date),
      anchor_day: splitDate(fields.renewal_date)[2],
      cycle: fields.cycle ?? serviceTypeDef(fields.type).defaultCycle,
      cost_agorot: fields.cost_agorot ?? 0,
      price_agorot: fields.price_agorot ?? 0,
      paid_until: extra.paid_until ?? null,
      auto_renew: fields.auto_renew ?? false,
      source: extra.source ?? 'manual',
      external_ref: extra.external_ref ?? null,
      note: fields.note ?? null,
    },
    now,
  );
  await deps.repo.history.add({
    client_id: clientId,
    service_id: service.id,
    text: `נוסף ${serviceTitle(service)}`,
    created_at: now,
  });
  return service;
}

export async function updateService(
  deps: Deps,
  serviceId: number,
  fields: Partial<ServiceFields>,
): Promise<Service> {
  const service = await deps.repo.services.get(serviceId);
  if (!service) notFound();
  const patch: ServicePatch = {
    type: fields.type,
    label: fields.label,
    quantity: fields.quantity,
    cycle: fields.cycle,
    cost_agorot: fields.cost_agorot,
    price_agorot: fields.price_agorot,
    auto_renew: fields.auto_renew,
    note: fields.note,
  };
  if (fields.renewal_date !== undefined && fields.renewal_date !== fromStoredDate(service.renewal_date)) {
    patch.renewal_date = toStoredDate(fields.renewal_date);
    patch.anchor_day = splitDate(fields.renewal_date)[2];
  }
  await deps.repo.services.update(serviceId, patch);
  return (await deps.repo.services.get(serviceId))!;
}

export async function archiveService(deps: Deps, serviceId: number, reason = 'הועבר לארכיון'): Promise<void> {
  const service = await deps.repo.services.get(serviceId);
  if (!service) notFound();
  if (service.archived_at) return;
  const now = deps.now().toISOString();
  await deps.repo.db.batch([
    deps.repo.services.updateStatement(serviceId, { archived_at: now })!,
    deps.repo.history.insertStatement({
      client_id: service.client_id,
      service_id: serviceId,
      text: `${serviceTitle(service)} ${reason}`,
      created_at: now,
    }),
  ]);
}

export interface MarkPaidResult {
  service: Service;
  payment: Omit<Payment, 'id'> | null;
  /** True when the renewal had already been marked (e.g. a second tap on "שולם"). */
  alreadyPaid: boolean;
}

/**
 * "סמן כשולם". `expectedRenewalDate` (YYYY-MM-DD) makes the call idempotent:
 * when the service has already moved past that renewal, nothing changes.
 */
export async function markServicePaid(
  deps: Deps,
  serviceId: number,
  expectedRenewalDate?: string,
): Promise<MarkPaidResult> {
  const service = await deps.repo.services.get(serviceId);
  if (!service) notFound();
  const current = fromStoredDate(service.renewal_date);
  if (service.archived_at || (expectedRenewalDate !== undefined && expectedRenewalDate !== current)) {
    return { service, payment: null, alreadyPaid: true };
  }
  const plan = planMarkPaid(service, deps.now());
  // One transaction; the guard on renewal_date makes a concurrent second tap a no-op,
  // and the payment/history rows are only written when the update happened.
  const [res] = await deps.repo.db.batch([
    deps.repo.services.updateStatement(serviceId, plan.service, service.renewal_date)!,
    deps.repo.payments.insertStatement(plan.payment, true),
    deps.repo.history.insertStatement(
      { client_id: service.client_id, service_id: serviceId, text: plan.historyText, created_at: plan.payment.paid_at },
      true,
    ),
  ]);
  if (!res || res.changes === 0) {
    return { service: (await deps.repo.services.get(serviceId))!, payment: null, alreadyPaid: true };
  }
  deps.log.info('service.paid', { serviceId, amount: plan.payment.amount_agorot });
  return { service: (await deps.repo.services.get(serviceId))!, payment: plan.payment, alreadyPaid: false };
}
