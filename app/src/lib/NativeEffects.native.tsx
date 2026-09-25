import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { MARK_PAID_ACTION, markPaidFromNotification, pushData, registerPush, WELCOME_DONE_KEY } from './push.native';
import { queryClient } from './query';

/** Android: notification taps, the "שולם" action in the foreground, push registration, first-launch screen. */
export function NativeEffects() {
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void (async () => {
      if ((await AsyncStorage.getItem(WELCOME_DONE_KEY)) !== '1') router.push('/welcome');
      else await registerPush().catch(() => undefined);
    })();
  }, []);

  useEffect(() => {
    if (!last) return;
    const data = pushData(last.notification.request.content);
    if (last.actionIdentifier === MARK_PAID_ACTION) {
      void markPaidFromNotification(data, last.notification.request.identifier)
        .then(() => queryClient.invalidateQueries())
        .catch(() => undefined);
    } else if (data.deepLink) {
      router.push(data.deepLink as never);
    }
    void Notifications.clearLastNotificationResponseAsync();
  }, [last]);

  return null;
}
