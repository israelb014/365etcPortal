import type { MicrosoftSummary } from '@renewals/shared';
import type { Deps } from '../deps';
import type { Integration } from './integration';
import { createMicrosoftIntegration, MICROSOFT, type MicrosoftIntegration } from './microsoft';

/** Builds the integrations. Each one is inert until its credentials are configured. */
export function createIntegrations(deps: Omit<Deps, 'integrations'>): Integration[] {
  return [createMicrosoftIntegration(deps)];
}

export function microsoftIntegration(deps: Deps): MicrosoftIntegration | undefined {
  return deps.integrations.find((i): i is MicrosoftIntegration => i.type === MICROSOFT && 'link' in i);
}

export async function microsoftSummary(deps: Deps): Promise<MicrosoftSummary> {
  const ms = microsoftIntegration(deps);
  if (ms) return ms.describe();
  return {
    configured: false,
    connected: false,
    status: 'off',
    last_sync_at: null,
    last_error: null,
    consecutive_failures: 0,
    licenses_total: 0,
    licenses_used: 0,
    unassigned_users: 0,
    secret_expires_at: null,
  };
}
