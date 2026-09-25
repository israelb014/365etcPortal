import type { MsUserDetail } from '@renewals/shared';
import { Hono } from 'hono';
import type { AuthVars } from '../auth/middleware';
import type { Deps } from '../deps';
import { fail } from '../http';
import { microsoftIntegration } from '../integrations';
import { suggestClients } from '../integrations/microsoft/similarity';
import { createClient, notFound } from '../operations';
import { asBody, bad, int, text } from '../validate';

export function microsoftRoutes(deps: Deps) {
  const app = new Hono<{ Variables: AuthVars }>();

  app.get('/microsoft/users', async (c) => c.json(await deps.repo.msUsers.list()));

  app.get('/microsoft/users/:graphId', async (c) => {
    const user = await deps.repo.msUsers.get(c.req.param('graphId'));
    if (!user) notFound();
    const clients = (await deps.repo.clients.list()).filter((cl) => cl.archived_at === null);
    const row = await deps.repo.integrations.get('microsoft');
    const skus = row?.state_json
      ? ((JSON.parse(row.state_json) as { snapshot?: { skus?: Record<string, { name: string }> } }).snapshot?.skus ?? {})
      : {};
    const detail: MsUserDetail = {
      user,
      licenses: user.sku_ids.map((id) => skus[id]?.name ?? id),
      suggestions: suggestClients(user, clients),
      clients,
    };
    return c.json(detail);
  });

  app.post('/microsoft/users/:graphId/link', async (c) => {
    const ms = microsoftIntegration(deps);
    if (!ms) return fail(c, 400, 'not_configured', 'החיבור למיקרוסופט לא הוגדר');
    const graphId = c.req.param('graphId');
    if (!(await deps.repo.msUsers.get(graphId))) notFound();
    const body = asBody(await c.req.json().catch(() => null));
    let clientId = int(body, 'client_id', 1, Number.MAX_SAFE_INTEGER);
    if (clientId === undefined) {
      const name = text(body, 'new_client_name', { required: true, max: 120 });
      clientId = (await createClient(deps, { name })).id;
    } else {
      const client = await deps.repo.clients.get(clientId);
      if (!client || client.archived_at) bad('הלקוח לא נמצא');
    }
    await ms.link(graphId, clientId);
    return c.json({ client_id: clientId });
  });

  app.post('/integrations/microsoft/connect', async (c) => {
    const ms = microsoftIntegration(deps);
    if (!ms?.configured) return fail(c, 400, 'not_configured', 'החיבור למיקרוסופט לא הוגדר');
    await ms.connect();
    const summary = await ms.describe();
    if (summary.last_error) {
      await ms.disconnect();
      return fail(c, 502, 'connect_failed', summary.last_error);
    }
    return c.json(summary);
  });

  app.post('/integrations/microsoft/disconnect', async (c) => {
    await microsoftIntegration(deps)?.disconnect();
    return c.json({ ok: true });
  });

  return app;
}
