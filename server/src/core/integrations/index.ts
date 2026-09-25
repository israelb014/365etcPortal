import type { Deps } from '../deps';
import type { Integration } from './integration';

/** Builds the integrations whose credentials are configured. */
export function createIntegrations(_deps: Omit<Deps, 'integrations'>): Integration[] {
  return [];
}
