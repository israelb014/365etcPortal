import {
  buildHomeRows,
  daysUntilRenewal,
  formatMoney,
  israelDate,
  monthlyProfitAgorot,
  renewalText,
  type ClientRow,
  type MicrosoftSummary,
} from '@renewals/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSnapshot } from '../../lib/hooks';
import { useCanMutate } from '../../lib/online';
import { IconButton } from '../../ui/Button';
import { Icon, ServiceIcon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { Avatar, Banner, Card, Empty, Fab, Pill } from '../../ui/parts';
import { Press } from '../../ui/Press';
import { Ring } from '../../ui/Ring';
import { Screen } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { colors, radius, space, statusColors, type } from '../../ui/theme';
import { UpdateBanner } from '../../ui/UpdateBanner';

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: string }) {
  return (
    <Card style={styles.stat}>
      <Icon name={icon} size={18} color={tone ?? colors.muted} />
      <Text
        style={[type.number, value.length > 6 && styles.statLong, tone ? { color: tone } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={type.small} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

function LicenseRing({ ms }: { ms: MicrosoftSummary }) {
  const free = Math.max(0, ms.licenses_total - ms.licenses_used);
  return (
    <Press onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="רישיונות Microsoft 365">
      <Card style={styles.msCard}>
        <Ring
          size={84}
          stroke={9}
          progress={ms.licenses_total ? ms.licenses_used / ms.licenses_total : 0}
          color={colors.accent}
          label={`${ms.licenses_used} מתוך ${ms.licenses_total}`}
        >
          <Text style={[type.number, { fontSize: 20 }]}>{ms.licenses_used}</Text>
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.bodyStrong}>רישיונות Microsoft 365</Text>
          <Text style={type.label}>
            {ms.licenses_used} בשימוש מתוך {ms.licenses_total}
          </Text>
          <Text style={[type.label, { color: free > 0 ? colors.paid : colors.muted }]}>{free} פנויים</Text>
        </View>
      </Card>
    </Press>
  );
}

function ClientRowView({ row }: { row: ClientRow }) {
  const tone = statusColors[row.status];
  return (
    <Press
      onPress={() => router.push(`/client/${row.client.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${row.client.name}, ${renewalText(row.nextRenewalDays)}`}
      style={styles.row}
    >
      <Avatar name={row.client.name} color={row.status === 'paid' ? colors.accent : tone.fg} />
      <View style={styles.rowMain}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {row.client.name}
        </Text>
        <View style={styles.rowMeta}>
          {row.types.slice(0, 5).map((t) => (
            <ServiceIcon key={t} type={t} size={15} color={colors.muted} />
          ))}
          <Text style={type.small} numberOfLines={1}>
            {renewalText(row.nextRenewalDays)}
          </Text>
        </View>
      </View>
      <Pill status={row.status} />
    </Press>
  );
}

export default function Home() {
  const snapshot = useSnapshot();
  const canMutate = useCanMutate();
  const data = snapshot.data;

  const view = useMemo(() => {
    if (!data) return null;
    const today = israelDate(new Date());
    const rows = buildHomeRows(data.clients, data.services, today);
    const renewalsThisWeek = data.services.filter((s) => {
      const d = daysUntilRenewal(s, today);
      return d >= 0 && d <= 7;
    }).length;
    return {
      rows,
      renewalsThisWeek,
      unpaidClients: rows.filter((r) => r.status === 'unpaid').length,
      profit: monthlyProfitAgorot(data.services),
    };
  }, [data]);

  return (
    <Screen
      refreshing={snapshot.isRefetching}
      onRefresh={() => void snapshot.refetch()}
      overlay={<Fab label="לקוח חדש" onPress={() => router.push('/client/new')} disabled={!canMutate} />}
    >
      <View style={styles.header}>
        <View style={{ gap: space.sm, flex: 1 }}>
          <Text style={type.screenTitle}>חידושים</Text>
          <StatusChip updatedAt={snapshot.dataUpdatedAt} fetching={snapshot.isFetching} />
        </View>
        <IconButton icon="settings" label="הגדרות" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ gap: space.md }}>
        <UpdateBanner />
        {data && data.microsoft.unassigned_users > 0 ? (
          <Banner icon="userPlus" text="משתמש חדש מחכה לשיוך" onPress={() => router.push('/assign')} />
        ) : null}
      </View>

      {snapshot.isPending && !data ? (
        <Text style={[type.label, { marginTop: space.xl }]}>טוען…</Text>
      ) : null}
      {snapshot.isError && !data ? (
        <Banner icon="alert" tone="danger" text="לא הצלחנו לטעון. משוך למטה כדי לנסות שוב" />
      ) : null}

      {view && data ? (
        <>
          <View style={styles.stats}>
            <Stat icon="calendar" label="חידושים השבוע" value={String(view.renewalsThisWeek)} />
            <Stat
              icon="alert"
              label="לא שילמו"
              value={String(view.unpaidClients)}
              tone={view.unpaidClients > 0 ? colors.unpaid : undefined}
            />
            <Stat icon="coins" label="רווח החודש" value={formatMoney(Math.round(view.profit / 100) * 100)} />
          </View>

          {data.microsoft.connected && data.microsoft.licenses_total > 0 ? <LicenseRing ms={data.microsoft} /> : null}

          <Text style={[type.sectionTitle, styles.listTitle]}>לקוחות</Text>
          {view.rows.length === 0 ? (
            <Empty icon="users" title="עוד אין לקוחות" text="לחיצה על + מוסיפה לקוח ראשון" />
          ) : (
            <View style={{ gap: space.sm }}>
              {view.rows.map((row) => (
                <ClientRowView key={row.client.id} row={row} />
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.lg },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  stat: { flex: 1, padding: space.md, gap: 4, minHeight: 112 },
  statLong: { fontSize: 19, lineHeight: 32 },
  msCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  listTitle: { marginTop: space.xl, marginBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 72,
  },
  rowMain: { flex: 1, gap: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
