import { formatDate, formatTime, israelDate, searchCities, type MicrosoftSummary } from '@renewals/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { FlatList, Modal, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { openBatterySettings } from '../../lib/battery';
import { APP_VERSION } from '../../lib/config';
import { useMicrosoftConnection, useSettings, useSnapshot, useUpdateSettings, useVersion } from '../../lib/hooks';
import { useCanMutate } from '../../lib/online';
import { Button, IconButton } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { TextField } from '../../ui/fields';
import { Header } from '../../ui/Header';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { Card, SectionTitle, Toggle } from '../../ui/parts';
import { Press } from '../../ui/Press';
import { Screen } from '../../ui/Screen';
import { colors, fonts, MAX_WEB_WIDTH, radius, space, type } from '../../ui/theme';

function Row({ icon, title, text, right }: { icon: IconName; title: string; text?: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        {text ? <Text style={type.small}>{text}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function microsoftText(ms: MicrosoftSummary): string {
  if (!ms.configured) return 'לא הוגדר. ההגדרה נעשית לפי המדריך';
  if (!ms.connected) return 'לא מחובר';
  if (ms.status === 'error') return 'יש בעיה בחיבור למיקרוסופט';
  const last = ms.last_sync_at ? `עודכן ${formatTime(new Date(ms.last_sync_at))}` : 'ממתין לעדכון ראשון';
  return `מחובר · ${last}`;
}

function CityPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: string) => void }) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.picker, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.pickerInner}>
          <View style={styles.pickerHead}>
            <Text style={type.screenTitle}>עיר</Text>
            <IconButton icon="close" label="סגירה" onPress={onClose} />
          </View>
          <TextField
            label="חיפוש"
            value={query}
            onChangeText={setQuery}
            autoFocus
            suffix={<Icon name="search" size={18} color={colors.muted} />}
          />
          <FlatList
            data={searchCities(query)}
            keyExtractor={(c) => c.name}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Press
                onPress={() => {
                  onPick(item.name);
                  setQuery('');
                }}
                accessibilityRole="button"
                style={styles.cityRow}
              >
                <Text style={type.body}>{item.name}</Text>
              </Press>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const canMutate = useCanMutate();
  const snapshot = useSnapshot();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const version = useVersion();
  const msConnection = useMicrosoftConnection();
  const [cityOpen, setCityOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const testPush = useMutation({ mutationFn: () => api<{ sent: number }>('/api/v1/notifications/test', { method: 'POST' }) });
  const exportData = useMutation({
    mutationFn: async () => {
      if (Platform.OS === 'web') {
        window.location.href = '/api/v1/export';
        return;
      }
      const data = await api<unknown>('/api/v1/export');
      await Share.share({ title: 'ייצוא נתונים', message: JSON.stringify(data, null, 2) });
    },
  });

  const ms = snapshot.data?.microsoft;
  const s = settings.data;

  return (
    <Screen refreshing={settings.isRefetching} onRefresh={() => void Promise.all([settings.refetch(), snapshot.refetch()])}>
      <Header title="הגדרות" />

      <SectionTitle>Microsoft 365</SectionTitle>
      <Card style={{ gap: space.md }}>
        {ms ? (
          <>
            <Row icon="link" title="חיבור למיקרוסופט" text={microsoftText(ms)} />
            {ms.connected && ms.status === 'error' && ms.last_error ? (
              <Text style={[type.small, { color: colors.unpaid }]}>{ms.last_error}</Text>
            ) : null}
            {ms.secret_expires_at ? (
              <Text style={type.small}>המפתח של מיקרוסופט בתוקף עד {formatDate(ms.secret_expires_at)}</Text>
            ) : null}
            {ms.configured ? (
              ms.connected ? (
                <Button title="ניתוק" variant="secondary" disabled={!canMutate} onPress={() => setConfirmDisconnect(true)} />
              ) : (
                <Button
                  title="חיבור"
                  disabled={!canMutate}
                  loading={msConnection.isPending}
                  onPress={() => msConnection.mutate('connect')}
                />
              )
            ) : null}
            {msConnection.isError ? (
              <Text style={[type.small, { color: colors.unpaid }]}>{msConnection.error.message}</Text>
            ) : null}
          </>
        ) : (
          <Text style={type.label}>טוען…</Text>
        )}
      </Card>

      <SectionTitle>שעות שקט</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Row
          icon="moon"
          title="שעות שקט"
          text="23:00–07:00, שבת וחג. ההתראות יישלחו אחר כך בסיכום אחד"
          right={
            <Toggle
              label="שעות שקט"
              value={s?.quiet_hours_enabled ?? true}
              disabled={!canMutate || !s}
              onChange={(v) => updateSettings.mutate({ quiet_hours_enabled: v })}
            />
          }
        />
        <Press
          onPress={() => setCityOpen(true)}
          disabled={!canMutate || !s}
          accessibilityRole="button"
          accessibilityLabel="בחירת עיר לזמני שבת"
          style={styles.cityButton}
        >
          <Text style={type.label}>עיר לזמני שבת</Text>
          <Text style={styles.cityValue}>{s?.quiet_hours_city ?? '—'}</Text>
          <Icon name="chevron" size={18} color={colors.muted} />
        </Press>
      </Card>

      <SectionTitle>התראות</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Button
          title="שלח התראת בדיקה"
          icon="bell"
          variant="secondary"
          disabled={!canMutate}
          loading={testPush.isPending}
          onPress={() => testPush.mutate()}
        />
        {testPush.isSuccess ? (
          <Text style={type.small}>
            {testPush.data.sent > 0 ? `נשלחה ל-${testPush.data.sent} מכשירים` : 'אין טלפון רשום להתראות'}
          </Text>
        ) : null}
        {testPush.isError ? <Text style={[type.small, { color: colors.unpaid }]}>{testPush.error.message}</Text> : null}
        {Platform.OS === 'android' ? (
          <Button title="הגדרות סוללה" icon="battery" variant="ghost" onPress={() => void openBatterySettings()} />
        ) : null}
      </Card>

      <SectionTitle>נתונים</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Button
          title="ייצוא כל הנתונים"
          icon="download"
          variant="secondary"
          disabled={!canMutate}
          loading={exportData.isPending}
          onPress={() => exportData.mutate()}
        />
        <Button title="התנתקות" icon="logout" variant="danger" onPress={() => setConfirmLogout(true)} />
      </Card>

      <Text style={[type.small, styles.version]}>
        גרסה {APP_VERSION}
        {version.data ? ` · שרת ${version.data.server_version}` : ''} · {formatDate(israelDate(new Date()))}
      </Text>

      <CityPicker
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(city) => {
          setCityOpen(false);
          updateSettings.mutate({ quiet_hours_city: city });
        }}
      />
      <ConfirmDialog
        visible={confirmDisconnect}
        title="לנתק את מיקרוסופט?"
        text="לא יגיעו יותר עדכונים על רישיונות. הנתונים שכבר נשמרו יישארו."
        confirm="ניתוק"
        busy={msConnection.isPending}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={() => msConnection.mutate('disconnect', { onSettled: () => setConfirmDisconnect(false) })}
      />
      <ConfirmDialog
        visible={confirmLogout}
        title="להתנתק?"
        confirm="התנתקות"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          void signOut({ remote: canMutate });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.row,
    backgroundColor: colors.pendingBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  cityValue: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  version: { textAlign: 'center', marginTop: space.xxl },
  picker: { flex: 1, backgroundColor: colors.bg },
  pickerInner: { flex: 1, width: '100%', maxWidth: MAX_WEB_WIDTH, alignSelf: 'center', paddingHorizontal: space.lg },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  cityRow: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
});
