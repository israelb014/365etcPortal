import { Hono } from 'hono';
import { requireAuth, type AuthVars } from './auth/middleware';
import { SERVER_VERSION } from './config';
import type { Deps } from './deps';
import { fail, HttpError, requireFetchHeader, securityHeaders } from './http';
import { apiAuthRoutes, webAuthRoutes } from './routes/auth';

/** The HTTP app (API + web auth + static web app). Platform-free. */
export function createApp(deps: Deps) {
  const app = new Hono();

  app.use('*', securityHeaders);
  app.use('/api/*', async (c, next) => {
    await next();
    c.res.headers.set('Cache-Control', 'no-store');
  });
  app.use('/api/*', requireFetchHeader);

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.code, err.message);
    deps.log.error('http.unhandled', { path: c.req.path, method: c.req.method, error: err });
    return fail(c, 500, 'server_error', 'משהו השתבש');
  });

  app.get('/api/version', (c) =>
    c.json({
      server_version: SERVER_VERSION,
      min_app_version: deps.config.minAppVersion,
      apk_url: deps.config.apkUrl,
    }),
  );

  app.route('/auth', webAuthRoutes(deps));
  app.route('/api/v1/auth', apiAuthRoutes(deps));

  const api = new Hono<{ Variables: AuthVars }>();
  api.use('*', requireAuth(deps));
  api.get('/me', (c) => c.json({ email: deps.config.ownerEmail, session: c.get('auth').session.kind }));
  app.route('/api/v1', api);

  app.all('/api/*', (c) => fail(c, 404, 'not_found', 'לא נמצא'));

  // Everything else is the web app.
  app.all('*', async (c) => {
    if (!deps.assets) return c.text('Not found', 404);
    return deps.assets(c.req.raw);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
