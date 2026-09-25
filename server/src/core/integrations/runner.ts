import type { Deps } from '../deps';

/** Runs every configured integration; one failing does not stop the others. */
export async function runIntegrations(deps: Deps): Promise<void> {
  const errors: unknown[] = [];
  for (const integration of deps.integrations) {
    if (!integration.configured) continue;
    try {
      await integration.sync();
    } catch (e) {
      errors.push(e);
    }
  }
  if (errors.length > 0) throw errors[0];
}
