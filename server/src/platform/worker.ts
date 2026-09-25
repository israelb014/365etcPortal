import { createApp } from '../core/app';
import { googleJwks } from '../core/auth/google';
import { missingConfig, readConfig } from '../core/config';
import { runCron } from '../core/cron';
import type { Deps } from '../core/deps';
import { createIntegrations } from '../core/integrations';
import { createLogger } from '../core/log';
import { expoPushSender } from '../core/notifications/push';
import { createRepo } from '../core/repo';
import { d1Db } from './d1';

/** Cloudflare bindings and variables (see wrangler.jsonc and SETUP.md). */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  [key: string]: unknown;
}

const log = createLogger();

function buildDeps(env: Env): Deps {
  const config = readConfig(env);
  const missing = missingConfig(config);
  if (missing.length > 0) log.warn('config.missing', { missing });
  const repo = createRepo(d1Db(env.DB));
  const fetchFn: typeof fetch = (input, init) => fetch(input, init);
  const partial = {
    repo,
    config,
    log,
    now: () => new Date(),
    jwks: googleJwks(),
    fetch: fetchFn,
    push: expoPushSender(fetchFn, config.expoAccessToken),
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    assets: (request: Request) => env.ASSETS.fetch(request),
  };
  return { ...partial, integrations: createIntegrations(partial) };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const deps = buildDeps(env);
    return createApp(deps).fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const deps = buildDeps(env);
    deps.log.info("cron.tick", { scheduled: new Date(controller.scheduledTime).toISOString() });
    ctx.waitUntil(runCron(deps));
  },
} satisfies ExportedHandler<Env>;
