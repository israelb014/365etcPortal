/** Runtime configuration, read from the environment by the platform layer. */
export interface Config {
  appUrl: string;
  ownerEmail: string;
  sessionSecret: string;
  google: {
    webClientId: string;
    webClientSecret: string;
    androidClientId: string;
  };
  minAppVersion: string;
  apkUrl: string | null;
  expoAccessToken: string | null;
  microsoft: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    /** ISO date the client secret expires, or null when unknown. */
    secretExpiresAt: string | null;
  } | null;
}

export const SERVER_VERSION = '1.0.0';

type EnvLike = Record<string, unknown>;

function str(env: EnvLike, key: string): string {
  const v = env[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function readConfig(env: EnvLike): Config {
  const tenantId = str(env, 'MS_TENANT_ID');
  const clientId = str(env, 'MS_CLIENT_ID');
  const clientSecret = str(env, 'MS_CLIENT_SECRET');
  return {
    appUrl: str(env, 'APP_URL').replace(/\/$/, ''),
    ownerEmail: str(env, 'OWNER_EMAIL').toLowerCase(),
    sessionSecret: str(env, 'SESSION_SECRET'),
    google: {
      webClientId: str(env, 'GOOGLE_WEB_CLIENT_ID'),
      webClientSecret: str(env, 'GOOGLE_WEB_CLIENT_SECRET'),
      androidClientId: str(env, 'GOOGLE_ANDROID_CLIENT_ID'),
    },
    minAppVersion: str(env, 'MIN_APP_VERSION') || '1.0.0',
    apkUrl: str(env, 'APK_URL') || null,
    expoAccessToken: str(env, 'EXPO_ACCESS_TOKEN') || null,
    microsoft:
      tenantId && clientId && clientSecret
        ? { tenantId, clientId, clientSecret, secretExpiresAt: str(env, 'MS_SECRET_EXPIRES_AT') || null }
        : null,
  };
}

/** Names of required settings that are missing (logged at startup of each request batch). */
export function missingConfig(config: Config): string[] {
  const missing: string[] = [];
  if (!config.appUrl) missing.push('APP_URL');
  if (!config.ownerEmail) missing.push('OWNER_EMAIL');
  if (config.sessionSecret.length < 32) missing.push('SESSION_SECRET');
  if (!config.google.webClientId) missing.push('GOOGLE_WEB_CLIENT_ID');
  return missing;
}
