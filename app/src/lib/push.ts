import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { EAS_PROJECT_ID } from './config';

/**
 * Push notifications (Android). The server sends through Expo Push (FCM v1).
 * Payment reminders carry the "שולם" action, handled here without opening the app.
 */
export const PAYMENT_CATEGORY = 'payment';
export const MARK_PAID_ACTION = 'mark_paid';
export const CHANNEL_ID = 'default';
const TOKEN_KEY = 'push_token';
/** Set once the first-launch screen (notifications + battery) was shown. */
export const WELCOME_DONE_KEY = 'welcome_done';

export interface PushData {
  deepLink?: string;
  serviceId?: number;
  renewalDate?: string;
}

export function setupNotifications(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'חידושים ותשלומים',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#F0A23B',
  });
  void Notifications.setNotificationCategoryAsync(PAYMENT_CATEGORY, [
    { identifier: MARK_PAID_ACTION, buttonTitle: 'שולם', options: { opensAppToForeground: false } },
  ]);
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  return (await Notifications.getPermissionsAsync()).status;
}

/** Asks for permission (Android 13+ shows the system dialog). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Sends this phone's Expo push token to the server. Safe to call on every launch. */
export async function registerPush(): Promise<void> {
  if (Platform.OS === 'web' || !EAS_PROJECT_ID) return;
  if ((await notificationPermission()) !== 'granted') return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  await api('/api/v1/push-tokens', { method: 'POST', body: { token } });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await api('/api/v1/push-tokens', { method: 'DELETE', body: { token } });
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function pushData(content: { data?: unknown } | undefined): PushData {
  const d = (content?.data ?? {}) as Record<string, unknown>;
  return {
    deepLink: typeof d.deepLink === 'string' ? d.deepLink : undefined,
    serviceId: typeof d.serviceId === 'number' ? d.serviceId : undefined,
    renewalDate: typeof d.renewalDate === 'string' ? d.renewalDate : undefined,
  };
}

/** The "שולם" button: marks the service paid for exactly the renewal the notification was about. */
export async function markPaidFromNotification(data: PushData, notificationId?: string): Promise<void> {
  if (!data.serviceId || !data.renewalDate) return;
  await api(`/api/v1/services/${data.serviceId}/mark-paid`, {
    method: 'POST',
    body: { expected_renewal_date: data.renewalDate },
  });
  if (notificationId) await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
}
