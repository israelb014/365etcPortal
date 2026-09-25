import type { MicrosoftSummary } from '@renewals/shared';
import type { Deps } from '../deps';
import type { Integration } from './integration';

/** Builds the integrations whose credentials are configured. */
export function createIntegrations(_deps: Omit<Deps, 'integrations'>): Integration[] {
  return [];
}

export async function microsoftSummary(deps: Deps): Promise<MicrosoftSummary> {
  const ms = deps.integrations.find((i) => i.type === 'microsoft');
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
