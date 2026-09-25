/** Sending pushes through the Expo Push Service (FCM v1 behind it). */

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** Notification category (adds the "שולם" action button). */
  categoryId?: string;
}

export interface PushResult {
  token: string;
  ok: boolean;
  /** Expo says the token is dead (app uninstalled / re-installed). */
  invalidToken: boolean;
  error?: string;
}

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const ANDROID_CHANNEL_ID = 'default';

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export function expoPushSender(fetchFn: typeof fetch, accessToken: string | null): PushSender {
  return {
    async send(messages) {
      const results: PushResult[] = [];
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const res = await fetchFn(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(
            chunk.map((m) => ({
              to: m.to,
              title: m.title,
              body: m.body,
              data: m.data,
              sound: 'default',
              priority: 'high',
              channelId: ANDROID_CHANNEL_ID,
              ...(m.categoryId ? { categoryId: m.categoryId } : {}),
            })),
          ),
        });
        if (!res.ok) throw new Error(`Expo push failed: HTTP ${res.status}`);
        const json = (await res.json()) as { data?: ExpoTicket[] };
        const tickets = json.data ?? [];
        chunk.forEach((m, j) => {
          const t = tickets[j];
          const ok = t?.status === 'ok';
          results.push({
            token: m.to,
            ok,
            invalidToken: t?.details?.error === 'DeviceNotRegistered',
            error: ok ? undefined : (t?.details?.error ?? t?.message ?? 'no ticket'),
          });
        });
      }
      return results;
    },
  };
}
