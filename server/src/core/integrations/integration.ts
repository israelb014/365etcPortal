import type { MicrosoftSummary } from '@renewals/shared';

/**
 * An external source that keeps services up to date. Microsoft 365 is the
 * only one today; others (e.g. domain expiry via RDAP) plug in the same way.
 */
export interface Integration {
  readonly type: string;
  /** True when the credentials are set in the environment. */
  readonly configured: boolean;
  /** Pulls the latest state, diffs it and raises notifications. Throws on failure. */
  sync(): Promise<void>;
  describe(): Promise<MicrosoftSummary>;
}
