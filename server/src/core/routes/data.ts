import type { ClientDetail, Snapshot } from '@renewals/shared';
import { Hono } from 'hono';
import type { AuthVars } from '../auth/middleware';
import type { Deps } from '../deps';
import { microsoftSummary } from '../integrations';
import {
  archiveClient,
  archiveService,
  createClient,
  createService,
  markServicePaid,
  notFound,
  updateService,
  type ServiceFields,
} from '../operations';
import {
  asBody,
  bad,
  bool,
  cycle,
  date,
  idParam,
  int,
  MAX_AGOROT,
  serviceType,
  text,
  type Body,
} from '../validate';

const HISTORY_LIMIT = 10;

function serviceFields(body: Body, partial: boolean): Partial<ServiceFields> {
  const fields: Partial<ServiceFields> = {
    type: serviceType(body, 'type'),
    label: text(body, 'label', { max: 120 }),
    quantity: int(body, 'quantity', 1, 100_000),
    renewal_date: date(body, 'renewal_date'),
    cycle: cycle(body, 'cycle'),
    cost_agorot: int(body, 'cost_agorot', 0, MAX_AGOROT),
    price_agorot: int(body, 'price_agorot', 0, MAX_AGOROT),
    auto_renew: bool(body, 'auto_renew'),
    note: text(body, 'note', { max: 2000 }),
  };
  if (!partial && (!fields.type || !fields.renewal_date)) bad('חסר סוג שירות או תאריך חידוש');
  return fields;
}

export function dataRoutes(deps: Deps) {
  const app = new Hono<{ Variables: AuthVars }>();

  app.get('/snapshot', async (c) => {
    const [clients, services, microsoft] = await Promise.all([
      deps.repo.clients.list(),
      deps.repo.services.listActive(),
      microsoftSummary(deps),
    ]);
    const snapshot: Snapshot = {
      clients: clients.filter((cl) => cl.archived_at === null),
      services,
      microsoft,
      server_time: deps.now().toISOString(),
    };
    return c.json(snapshot);
  });

  app.get('/clients/:id', async (c) => {
    const id = idParam(c.req.param('id'));
    const client = await deps.repo.clients.get(id);
    if (!client) notFound();
    const detail: ClientDetail = {
      client,
      services: await deps.repo.services.listForClient(id),
      history: await deps.repo.history.listForClient(id, HISTORY_LIMIT),
    };
    return c.json(detail);
  });

  app.post('/clients', async (c) => {
    const body = asBody(await c.req.json().catch(() => null));
    const client = await createClient(deps, {
      name: text(body, 'name', { required: true, max: 120 }),
      phone: text(body, 'phone', { max: 40 }),
      note: text(body, 'note', { max: 2000 }),
    });
    return c.json(client, 201);
  });

  app.patch('/clients/:id', async (c) => {
    const id = idParam(c.req.param('id'));
    const body = asBody(await c.req.json().catch(() => null));
    if (!(await deps.repo.clients.get(id))) notFound();
    await deps.repo.clients.update(id, {
      name: body.name === undefined ? undefined : text(body, 'name', { required: true, max: 120 }),
      phone: text(body, 'phone', { max: 40 }),
      note: text(body, 'note', { max: 2000 }),
    });
    return c.json(await deps.repo.clients.get(id));
  });

  app.post('/clients/:id/archive', async (c) => {
    await archiveClient(deps, idParam(c.req.param('id')));
    return c.json({ ok: true });
  });

  app.post('/services', async (c) => {
    const body = asBody(await c.req.json().catch(() => null));
    const clientId = int(body, 'client_id', 1, Number.MAX_SAFE_INTEGER);
    if (!clientId) bad('חסר לקוח');
    const service = await createService(deps, clientId, serviceFields(body, false) as ServiceFields);
    return c.json(service, 201);
  });

  app.patch('/services/:id', async (c) => {
    const body = asBody(await c.req.json().catch(() => null));
    const service = await updateService(deps, idParam(c.req.param('id')), serviceFields(body, true));
    return c.json(service);
  });

  app.post('/services/:id/archive', async (c) => {
    await archiveService(deps, idParam(c.req.param('id')));
    return c.json({ ok: true });
  });

  app.post('/services/:id/mark-paid', async (c) => {
    const body = asBody(await c.req.json().catch(() => ({})));
    const result = await markServicePaid(deps, idParam(c.req.param('id')), date(body, 'expected_renewal_date'));
    return c.json({ service: result.service, payment: result.payment, already_paid: result.alreadyPaid });
  });

  app.get('/export', async (c) => {
    const data = {
      exported_at: deps.now().toISOString(),
      format: 'renewals-export-v1',
      settings: await deps.repo.settings.all(),
      clients: await deps.repo.clients.list(),
      services: await deps.repo.services.list(),
      payments: await deps.repo.payments.list(),
      history: await deps.repo.history.list(),
      ms_users: await deps.repo.msUsers.list(),
      notifications: await deps.repo.notifications.list(),
    };
    const day = data.exported_at.slice(0, 10);
    c.header('Content-Disposition', `attachment; filename="renewals-${day}.json"`);
    return c.json(data);
  });

  return app;
}
