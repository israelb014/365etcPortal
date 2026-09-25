# Decisions

Choices made where the brief left room, with the reason for each. The brief itself is not repeated here.

## Stack and dependencies

| Extra dependency | Why |
|---|---|
| `wrangler`, `@cloudflare/workers-types` (dev) | Cloudflare's deploy/dev CLI and the Worker type definitions. |
| `expo-router`, `expo-font`, `expo-constants`, `expo-linking`, `expo-status-bar`, `expo-web-browser`, `expo-crypto`, `react-native-screens`, `react-native-safe-area-context`, `react-dom`, `react-native-web` | Expo SDK 57 packages required by `expo-router`, `expo-auth-session` and Expo web. They are part of the Expo SDK, not third-party. |
| `expo-auth-session` | "Sign in with Google" on Android (named in the brief). |
| `expo-localization` | Its config plugin (`forcesRTL`) turns RTL on natively before JavaScript starts, so the app never shows an LTR first frame and needs no reload. `I18nManager.forceRTL(true)` is still called. |
| `expo-task-manager` | Needed by `expo-notifications` to run the "שולם" action while the app is closed. |
| `@react-native-async-storage/async-storage` | Storage for the persisted react-query cache. `expo-secure-store` has a 2 KB value limit, so it only holds the session token. |
| `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister` | The official way to persist the react-query cache. |
| `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` (dev) | Type checking and linting for `npm run check`. |
| `jest`, `jest-expo`, `@types/jest`, `react-test-renderer`, `@testing-library/react-native` (dev) | Jest for the app, as the brief requires. Testing Library renders real screens to prove that offline mode disables buttons. |
| `@types/node` (dev) | Types for the server tests (`node:sqlite`, `node:fs`). |

- All versions are pinned exactly. Expo packages use the versions in Expo SDK 57's `bundledNativeModules.json`, which is what `npx expo install` would pick.
- TypeScript is 6.0.3 because that is what Expo SDK 57 ships with, and typescript-eslint supports it. TypeScript 7 was released, but its tooling support is not ready yet.
- The server tests run on Node's built-in `node:sqlite` behind the same `Db` interface as D1, with every migration applied. This adds no dependency and needs no native build. It also proves that core logic is platform-free, because `server/test/tsconfig.json` type-checks `server/src/core` without the Workers types.

## Dates and money

- **Calendar dates** (`renewal_date`, `paid_until`, `covers_until`) are stored as `YYYY-MM-DDT00:00:00.000Z`. The date part is the Israel date, so it never shifts when converted. **Instants** (`created_at`, `paid_at`, `sent_at`) are real UTC timestamps.
- Israel time is computed from the fixed rule in the 2013 law: DST runs from the Friday before the last Sunday of March until the last Sunday of October, both at 02:00. It does not use `Intl`, so Workers, Node and Hermes on Android give identical results. A test compares it hour by hour against `Intl` for 2025–2026.
- `anchor_day` (an extra column) remembers the day of month. Without it, a monthly service due on the 31st would drift: Jan 31 → Feb 28 → Mar 28. With it the dates go Jan 31 → Feb 28 → Mar 31. It is updated whenever the renewal date is edited.
- The money input accepts `1,250.50`. The display is `₪1,250.50`. The home screen's profit is rounded to whole shekels.

## Status and payments

- `paid_until` means "the latest renewal date whose payment was recorded". "סמן כשולם" sets it to the renewal that was just paid and moves `renewal_date` forward one cycle. The payment's `covers_until` is the new renewal date. With this meaning, the brief's rule (`paid_until < renewal_date` → unpaid) works cycle after cycle. The next renewal becomes "ממתין" again 7 days before it.
- "Within 7 days" includes day 0 through day 7.
- A client with no active services counts as "שולם".
- "חידושים השבוע" counts active services renewing in the next 0–7 days. "לא שילמו" counts clients whose status is "לא שולם".
- Mark-paid is idempotent. The request carries `expected_renewal_date`, and the update is guarded on the current renewal date in one transaction. A double tap, or the notification button pressed twice, records only one payment.
- Archiving a client also archives its services, after a confirmation.

## Notifications

- A daily reminder fires for the nearest threshold that has been reached, and the dedupe key includes that threshold. A renewal first seen 20 days out gets one "30" reminder, then "7", then "1". A missed day never skips a reminder, and nothing ever repeats.
- For 1 day and 0 days the title reads "חידוש מחר" / "חידוש היום" instead of "בעוד 1 ימים", which is incorrect Hebrew.
- "לא שילם" is sent on overdue day 1, 8, 15… The dedupe key counts 7-day rounds, so a missed Cron day still sends exactly one reminder per week.
- Renewal reminders that are not yet paid also get the "שולם" action button. They are payment notifications too.
- A notification is marked `held` when it is created during quiet hours. When the quiet window ends, two or more held notifications go out as one summary. A single held notification is sent as itself, so it keeps its deep link and the "שולם" button.
- The test notification in Settings is sent immediately, even during quiet hours. It is a test.
- Sending is retried on the next Cron run. After 5 failed tries a notification is marked `failed`. With no phone registered, notifications fail after 5 tries instead of piling up.
- Expo push tickets are checked for `DeviceNotRegistered`, and those tokens are deleted. Delivery receipts are not polled, which keeps the server simpler. The ticket error covers the uninstall case that matters.
- "תקלה במערכת" is sent at most once per Israel day.
- For the "—" rows in the table (subscription deleted / active again) the body is the product name, e.g. "Business Standard", so the notification still says which subscription.
- The Microsoft-secret warning reads "החיבור למיקרוסופט ייפסק בעוד X ימים". It avoids the words "secret" and "client".

## Quiet hours

- A day is holy if it is Saturday or an Israeli Yom Tov: a `@hebcal/core` holiday with the `CHAG` flag, Israel schedule. Its window runs from 60 minutes before sunset on the previous day until 82 minutes after sunset on the day itself. Consecutive holy days (Shabbat + Yom Tov, both days of Rosh Hashana) merge into one window.
- Sunset uses the chosen city's coordinates. The city list in `shared/src/cities.ts` has 65 Israeli cities. The default is רמלה.
- The quiet-hours module lives in `shared/` but has its own entry point (`@renewals/shared/quiet-hours`), so the app bundle doesn't include `@hebcal/core`.

## Microsoft 365

- Connecting is a button in Settings. It checks the credentials by running the first sync, which records the state and sends nothing. Admin consent is given once in the Entra portal (SETUP.md step 4). There is no in-app consent redirect, because on Android the browser would not carry the session.
- Disconnecting stops syncing and forgets the snapshot, so reconnecting starts fresh and re-announces nothing.
- Free SKUs with 10,000 or more units (e.g. Power Automate Free) are left out of the license ring.
- Dedupe keys for Microsoft events include the timestamp of the previous sync. If a sync is retried after a partial failure, the events are the same and are not sent twice.
- A new user is "משתמש חדש" when they go from no licenses to licensed and are not linked to a client. Otherwise, getting a license is "רישיון הוקצה".
- The linked service is one per Microsoft user: type `microsoft365`, `source = microsoft`, `external_ref = graph id`. Its label is "Name (product)". Its renewal date is the earliest `nextLifecycleDateTime` among the user's subscriptions, or today + 1 year if there is none.
- Sync changes only the label, the archived state, and the renewal date (forward only). Price, cost, cycle and notes stay as the owner set them. Manual services are never touched.
- Re-linking a user to a different client archives the old client's Microsoft service and creates one for the new client.
- A Microsoft outage is not a system error. It is counted in `consecutive_failures`, and only the third failure in a row alerts ("יש בעיה בחיבור למיקרוסופט"). Recovery notifies once.
- Parallel Graph calls share one token request per sync. The 429/503 retry covers the token call too.
- The Microsoft user's name is matched against client names with bigram similarity on normalized tokens (Hebrew final letters folded; UPN local part and domain included). Up to 3 suggestions with a score of 0.4 or higher are shown first.

## App

- Web uses the HttpOnly cookie. It also stores a `signed_in` flag, so it can open offline straight to the cached data. Any 401 signs out locally.
- Buttons are disabled whenever NetInfo reports no connection, and also while the cache is being restored.
- Logout works offline: it clears local data, and the server session then expires on its own.
- "ייצוא כל הנתונים" downloads the JSON file on web. On Android it opens the share sheet with the JSON, which avoids adding a file-system dependency. Sessions and push tokens are not exported.
- The first-launch screen (notifications + battery) appears once after the first sign-in on Android. It uses `Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')`, which is built into React Native.
- Push, the background task and notification handling live in `*.native.ts(x)` files, with web stubs, so `expo-notifications` is not in the web bundle.
- On web, Latin names get `textAlign: 'right'` so they line up in the RTL layout. Android already aligns text to the RTL paragraph start.
- The date field is a text field in `dd/MM/yyyy` format, prefilled with the default. This avoids a date-picker dependency.

## Server and security

- The web session cookie is `__Host-session` with the value `token.HMAC(token)`. Only the SHA-256 of the token is stored. Sliding expiry is refreshed at most once an hour, to avoid a database write on every request.
- CSP allows `'unsafe-inline'` for styles only. Expo's `index.html` reset and react-native-web's runtime styles need it. Scripts are `'self'` only; the export has no inline scripts.
- The Worker runs first on every request (`run_worker_first: true`), so static files get the security headers too.
- `/api/version` is unversioned (as in the brief). Everything else is under `/api/v1`.
- Integration errors are recorded with a short Hebrew reason that Settings shows. Details go to the JSON logs.
- Expired sessions are cleaned up in the daily run.
