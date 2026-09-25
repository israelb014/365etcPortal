import type { Deps } from './deps';

/** Placeholder until the scheduled steps land. */
export async function runCron(deps: Deps, now: Date): Promise<void> {
  deps.log.info('cron.start', { at: now.toISOString() });
}
