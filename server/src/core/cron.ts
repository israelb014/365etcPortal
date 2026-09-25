import { israelDate } from '@renewals/shared';
import type { Deps } from './deps';
import { runIntegrations } from './integrations/runner';
import { notify, processQueue } from './notifications/queue';
import { runDailyReminders } from './notifications/reminders';
import { texts } from './notifications/texts';

export interface CronStep {
  name: string;
  run: (deps: Deps) => Promise<unknown>;
}

export const CRON_STEPS: CronStep[] = [
  { name: 'integrations', run: (deps) => runIntegrations(deps) },
  { name: 'reminders', run: (deps) => runDailyReminders(deps) },
  { name: 'queue', run: (deps) => processQueue(deps) },
];

/**
 * Every 15 minutes. Each step runs on its own: one failing never stops the
 * others. When any step throws, the owner gets "תקלה במערכת" (once a day).
 */
export async function runCron(deps: Deps, steps: CronStep[] = CRON_STEPS): Promise<{ failed: string[] }> {
  const started = Date.now();
  const failed: string[] = [];
  for (const step of steps) {
    try {
      await step.run(deps);
    } catch (e) {
      failed.push(step.name);
      deps.log.error('cron.step_failed', { step: step.name, error: e });
    }
  }
  if (failed.length > 0) {
    try {
      await notify(deps, {
        kind: 'system',
        ...texts.systemError(),
        deepLink: '/settings',
        dedupeKey: `system-error:${israelDate(deps.now())}`,
      });
      await processQueue(deps);
    } catch (e) {
      deps.log.error('cron.alert_failed', { error: e });
    }
  }
  deps.log.info('cron.done', { failed, ms: Date.now() - started });
  return { failed };
}
