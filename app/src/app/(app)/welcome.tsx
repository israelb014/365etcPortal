import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { openBatterySettings } from '../../lib/battery';
import { registerPush, requestNotificationPermission, WELCOME_DONE_KEY } from '../../lib/push';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { Card } from '../../ui/parts';
import { Screen } from '../../ui/Screen';
import { colors, radius, space, type } from '../../ui/theme';

function Step({ icon, title, text, children }: { icon: IconName; title: string; text: string; children: ReactNode }) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.stepHead}>
        <View style={styles.stepIcon}>
          <Icon name={icon} color={colors.accent} />
        </View>
        <Text style={[type.sectionTitle, { flex: 1 }]}>{title}</Text>
      </View>
      <Text style={[type.body, { color: colors.muted }]}>{text}</Text>
      {children}
    </Card>
  );
}

/** One-time screen on first launch (Android): notifications + battery optimization. */
export default function Welcome() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const finish = async () => {
    await AsyncStorage.setItem(WELCOME_DONE_KEY, '1');
    await registerPush().catch(() => undefined);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <Screen>
      <Text style={[type.screenTitle, { marginBottom: space.xl }]}>ברוך הבא</Text>
      <View style={{ gap: space.md }}>
        <Step icon="bell" title="התראות" text="כדי לקבל תזכורות על חידושים ותשלומים בזמן.">
          <Button
            title={granted ? 'ההתראות פעילות' : 'אישור התראות'}
            icon={granted ? 'check' : 'bell'}
            disabled={granted === true}
            onPress={() => void requestNotificationPermission().then(setGranted)}
          />
          {granted === false ? (
            <Text style={[type.small, { color: colors.unpaid }]}>אפשר להפעיל אחר כך בהגדרות הטלפון</Text>
          ) : null}
        </Step>
        <Step icon="battery" title="חיסכון בסוללה" text="בלי זה, הטלפון עלול לעכב התראות. כדאי לבחור ״ללא הגבלה״ לאפליקציה.">
          <Button title="פתח הגדרות סוללה" variant="secondary" icon="battery" onPress={() => void openBatterySettings()} />
        </Step>
      </View>
      <Button title="המשך" big onPress={() => void finish()} style={{ marginTop: space.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.row,
    backgroundColor: colors.pendingBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
