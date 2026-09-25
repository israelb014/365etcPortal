/**
 * Web build: no push notifications (the phone app handles them). Same API as
 * push.native.ts so shared screens can import it; keeps expo-notifications out
 * of the web bundle.
 */
export const PAYMENT_CATEGORY = 'payment';
export const MARK_PAID_ACTION = 'mark_paid';
export const WELCOME_DONE_KEY = 'welcome_done';

export interface PushData {
  deepLink?: string;
  serviceId?: number;
  renewalDate?: string;
}

export function setupNotifications(): void {}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  return 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function registerPush(): Promise<void> {}

export async function unregisterPush(): Promise<void> {}
