# Renewals Tracker

A personal system for one IT provider to track client renewals (Microsoft 365, antivirus, domains, hosting, backup…), prices and payments. It sends push notifications to the owner's phone. It is single-user: only `OWNER_EMAIL` can sign in, and clients never get access.

- **Server:** one Cloudflare Worker (Hono, TypeScript) with D1 and a 15-minute Cron Trigger. It serves the API and the web app on the owner's domain.
- **Client:** one Expo (SDK 57, expo-router) codebase. It builds the **Android APK** (EAS, installed from a download link) and the **web app** (served by the Worker).
- **Notifications:** Expo Push Service with FCM v1, sent by the server.

Setup for the owner, in Hebrew, step by step: **[SETUP.md](SETUP.md)**. Design choices: **[DECISIONS.md](DECISIONS.md)**.

## Architecture

```
shared/   Types and pure logic used by both sides: Israel dates, status, mark-paid math,
          monthly profit, service-type list (name + icon), cities, quiet hours (@hebcal/core).
server/
  src/core/       Platform-free: Hono app, auth, repository (SQL), notifications, cron, integrations.
  src/platform/   Cloudflare only: Worker entry (fetch + scheduled), D1 adapter, env bindings.
  migrations/     Versioned D1 migrations. Never edit a released one; add a new file.
  test/           Vitest. Core runs on node:sqlite behind the same Db interface as D1.
app/
  src/app/        expo-router screens (login, home, client, service, settings, assign, welcome).
  src/lib/        API client, auth, persisted react-query cache, online state, push (native only).
  src/ui/         Design tokens, SVG icons, rings, buttons, fields, dialogs, error boundary.
  test/           Jest (jest-expo).
```

### Cron (every 15 minutes)

Each step runs on its own, so one failure never stops the others. If any step throws, the owner gets "תקלה במערכת" (at most once a day).

1. **Integrations:** Microsoft 365 sync (when configured and connected). The first sync only records the state. Later syncs diff against it and raise events.
2. **Daily reminders:** on the first run after 09:00 Israel time: renewals in 30 / 7 / 1 days, "not paid" (day 1, then every 7 days), and the Microsoft secret expiring in 30 / 7 / 1 days.
3. **Queue:** sends queued notifications to every registered phone, unless it is quiet time (23:00–07:00, Shabbat and Yom Tov). Anything collected during quiet time goes out as one summary.

Every notification has a unique `dedupe_key`, so nothing notifies twice.

### Adding a service type

Add one entry to `SERVICE_TYPES` in `shared/src/serviceTypes.ts`: id, Hebrew name, SVG path(s) and default cycle. Nothing else changes.

### Adding an integration

Implement `Integration` (`server/src/core/integrations/integration.ts`: `sync()`, `describe()`) and add it in `createIntegrations`.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs all workspaces and enables the pre-commit hook (`.githooks/pre-commit`). |
| `npm run check` | Typecheck + lint + all tests (Vitest for shared/server, Jest for the app). Runs before every commit and in GitHub Actions. |
| `npm run dev -w server` | Worker locally (`wrangler dev`, local D1). Copy `server/.dev.vars.example` to `server/.dev.vars` first. |
| `npm run migrate:local -w server` | Applies migrations to the local D1. |
| `npm run web -w app` | Expo web dev server. |
| `npm run build:web` | Exports the web app to `app/dist` (served by the Worker). |
| `npm run deploy` | Builds the web app, applies D1 migrations remotely and deploys the Worker. |
| `npm run build:apk` | Builds the Android APK with EAS (`production` profile, `buildType: apk`). |

## Environment

### Worker (`wrangler.jsonc` vars + `wrangler secret put`)

| Name | Required | Kind | Meaning |
|---|---|---|---|
| `APP_URL` | yes | var | The site's address, e.g. `https://renewals.example.com` (never hard-coded). |
| `MIN_APP_VERSION` | yes | var | Oldest Android app version the server accepts. Older apps show "יש גרסה חדשה". |
| `OWNER_EMAIL` | yes | secret | The only Google account allowed to sign in. |
| `SESSION_SECRET` | yes | secret | At least 32 random characters; signs the web session cookie. |
| `GOOGLE_WEB_CLIENT_ID` | yes | secret | Google OAuth "Web application" client ID. |
| `GOOGLE_WEB_CLIENT_SECRET` | yes | secret | Its client secret (web redirect flow). |
| `GOOGLE_ANDROID_CLIENT_ID` | yes | secret | Google OAuth "Android" client ID (accepted as an ID-token audience). |
| `APK_URL` | no | secret/var | Download link of the latest APK, used by "יש גרסה חדשה". |
| `EXPO_ACCESS_TOKEN` | no | secret | Needed only if "Enhanced push security" is on in Expo. |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | no | secret | Microsoft 365 integration. If any is missing the integration is off. |
| `MS_SECRET_EXPIRES_AT` | no | secret/var | `YYYY-MM-DD` the Microsoft client secret expires (warnings at 30 / 7 / 1 days). |

Bindings: `DB` (D1 database `renewals`), `ASSETS` (`app/dist`).

### App build (EAS, `app/eas.json` → `build.production.env`)

| Name | Meaning |
|---|---|
| `APP_URL` | Same address as the Worker's; the APK calls the API there. |
| `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID` | Used by `expo-auth-session` on Android. |
| `EAS_PROJECT_ID` | Expo project ID (for push tokens). |
| `GOOGLE_SERVICES_JSON` | EAS **file** environment variable with Firebase's `google-services.json` (FCM). |

## API

All endpoints are versioned under `/api/v1`; existing endpoints are never broken (new ones are added instead). Mutations require `X-Requested-With: fetch`. Every response carries a strict CSP, `frame-ancestors 'none'` and `nosniff`.

- `GET /api/version` returns the server version, the minimum app version and the APK URL.
- `GET /auth/google/start` and `GET /auth/google/callback`: the web sign-in redirect flow.
- `POST /api/v1/auth/google {idToken}` returns `{token}` (app). `POST /api/v1/auth/logout` signs out.
- `GET /api/v1/snapshot` (home) · `GET /api/v1/clients/:id` · `POST /api/v1/clients` · `PATCH /api/v1/clients/:id` · `POST /api/v1/clients/:id/archive`
- `POST /api/v1/services` · `PATCH /api/v1/services/:id` · `POST /api/v1/services/:id/archive` · `POST /api/v1/services/:id/mark-paid {expected_renewal_date?}`
- `GET|PATCH /api/v1/settings` · `POST|DELETE /api/v1/push-tokens` · `POST /api/v1/notifications/test` · `GET /api/v1/export`
- `GET /api/v1/microsoft/users` · `GET /api/v1/microsoft/users/:graphId` · `POST /api/v1/microsoft/users/:graphId/link` · `POST /api/v1/integrations/microsoft/connect|disconnect`

## Reliability

- **Migrations** are versioned (`server/migrations`) and applied by `npm run deploy`.
- **Logs** are structured JSON (one object per line), visible in Cloudflare → Workers → Logs.
- **Backups:** D1 Time Travel keeps 30 days of history and can restore to any minute. "ייצוא כל הנתונים" in Settings downloads everything as JSON.
- **Offline:** the app shows the last cached data with "אין חיבור — עודכן {time}", and every button that changes data is disabled.
