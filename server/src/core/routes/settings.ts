import { ISRAEL_CITIES } from '@renewals/shared';
import { Hono } from 'hono';
import type { AuthVars } from '../auth/middleware';
import type { Deps } from '../deps';
import { deliver } from '../notifications/queue';
import { texts } from '../notifications/texts';
import { SETTING_KEYS } from '../repo';
import { asBody, bad, bool } from '../validate';

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;

export function settingsRoutes(deps: Deps) {
  const app = new Hono<{ Variables: AuthVars }>();

  app.get('/settings', async (c) => c.json(await deps.repo.settings.all()));

  app.patch('/settings', async (c) => {
    const body = asBody(await c.req.json().catch(() => null));
    const enabled = bool(body, 'quiet_hours_enabled');
    if (enabled !== undefined) await deps.repo.settings.set(SETTING_KEYS.quietEnabled, enabled ? '1' : '0');
    if (body.quiet_hours_city !== undefined) {
      const city = body.quiet_hours_city;
      if (typeof city !== 'string' || !ISRAEL_CITIES.some((x) => x.name === city)) bad('עיר לא מוכרת');
      await deps.repo.settings.set(SETTING_KEYS.quietCity, city);
    }
    return c.json(await deps.repo.settings.all());
  });

  app.post('/push-tokens', async (c) => {
    const body = asBody(await c.req.json().catch(() => null));
    if (typeof body.token !== 'string' || !EXPO_TOKEN.test(body.token)) bad('קוד התראות לא תקין');
    await deps.repo.pushTokens.add(body.token, deps.now().toISOString());
    return c.json({ ok: true });
  });

  app.delete('/push-tokens', async (c) => {
    const body = asBody(await c.req.json().catch(() => null));
    if (typeof body.token === 'string') await deps.repo.pushTokens.remove(body.token);
    return c.json({ ok: true });
  });

  // Test notification: sent right away (no quiet hours, no queue).
  app.post('/notifications/test', async (c) => {
    const sent = await deliver(deps, (to) => ({ to, ...texts.test(), data: { deepLink: '/settings' } }));
    return c.json({ sent });
  });

  return app;
}
