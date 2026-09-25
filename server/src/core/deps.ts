import type { JWTVerifyGetKey } from 'jose';
import type { Config } from './config';
import type { Integration } from './integrations/integration';
import type { Logger } from './log';
import type { PushSender } from './notifications/push';
import type { Repo } from './repo';

/** Everything core logic needs from the outside world. Built by the platform layer. */
export interface Deps {
  repo: Repo;
  config: Config;
  log: Logger;
  now: () => Date;
  /** Google signing keys. */
  jwks: JWTVerifyGetKey;
  /** Outbound HTTP (Google token exchange, Microsoft Graph, Expo push). */
  fetch: typeof fetch;
  push: PushSender;
  integrations: Integration[];
  /** Waits between retries; replaced in tests. */
  sleep: (ms: number) => Promise<void>;
  /** Serves the web app's static files (platform-specific). */
  assets?: (request: Request) => Promise<Response>;
}
