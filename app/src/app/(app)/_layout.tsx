import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { MARK_PAID_ACTION, markPaidFromNotification, pushData, registerPush, WELCOME_DONE_KEY } from '../../lib/push';
import { queryClient } from '../../lib/query';
import { useReducedMotion } from '../../ui/motion';
import { colors } from '../../ui/theme';

/** Native only: notification taps, the "שולם" action in the foreground, push registration. */
function NativeEffects() {
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

export default function AppLayout() {
  const reduced = useReducedMotion();
  return (
    <>
      {Platform.OS !== 'web' ? <NativeEffects /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: reduced ? 'none' : 'fade',
          animationDuration: 220,
        }}
      />
    </>
  );
}
