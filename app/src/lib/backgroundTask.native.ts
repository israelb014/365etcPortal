import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { MARK_PAID_ACTION, markPaidFromNotification, pushData } from './push.native';

/**
 * Runs when the "שולם" action is tapped while the app is in the background or
 * closed (Android). Must be defined at module scope before the app renders,
 * so it is imported from the entry file (index.ts).
 */
export const NOTIFICATION_TASK = 'renewals-notification-task';

if (Platform.OS !== 'web') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
    if (data && 'actionIdentifier' in data && data.actionIdentifier === MARK_PAID_ACTION) {
      const content = data.notification.request.content;
      await markPaidFromNotification(pushData(content), data.notification.request.identifier).catch(() => undefined);
    }
    return Notifications.BackgroundNotificationTaskResult.NoData;
  });
  void Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => undefined);
}
