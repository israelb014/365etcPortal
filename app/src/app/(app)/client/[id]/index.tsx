import {
  CYCLE_NAMES,
  daysUntilRenewal,
  formatDate,
  formatMoney,
  israelDate,
  serviceStatus,
  serviceTitle,
  type Service,
} from '@renewals/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useClientDetail, useMarkPaid } from '../../../../lib/hooks';
import { useCanMutate } from '../../../../lib/online';
import { Button, IconButton } from '../../../../ui/Button';
import { Header } from '../../../../ui/Header';
import { Icon, ServiceIcon } from '../../../../ui/Icon';
import { Card, Empty, Pill, SectionTitle } from '../../../../ui/parts';
import { Press } from '../../../../ui/Press';
import { Ring } from '../../../../ui/Ring';
import { Screen } from '../../../../ui/Screen';
import { StatusChip } from '../../../../ui/StatusChip';
import { colors, fonts, radius, space, statusColors, type } from '../../../../ui/theme';

const PERIOD_DAYS = { monthly: 30, yearly: 365, once: 365 } as const;

function ServiceCard({ service, clientId }: { service: Service; clientId: number }) {
  const today = israelDate(new Date());
  const status = serviceStatus(service, today);
  const days = daysUntilRenewal(service, today);
  const tone = statusColors[status];
  const markPaid = useMarkPaid(clientId);
  const canMutate = useCanMutate();
  const ringColor = status === 'paid' ? colors.paid : tone.fg;
  const progress = days < 0 ? 1 : Math.min(1, days / PERIOD_DAYS[service.cycle]);

  return (
    <Card style={styles.serviceCard}>
      <Press
        onPress={() => router.push(`/service/${service.id}/edit?clientId=${clientId}`)}
        accessibilityRole="button"
        accessibilityLabel={`עריכת ${serviceTitle(service)}`}
        scaleTo={0.99}
      >
        <View style={styles.serviceTop}>
          <View style={styles.typeBadge}>
            <ServiceIcon type={service.type} size={24} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={type.bodyStrong} numberOfLines={2}>
              {serviceTitle(service)}
            </Text>
            <Pill status={status} />
          </View>
          <Ring size={76} stroke={8} progress={progress} color={ringColor} label={`${days} ימים לחידוש`}>
            <Text style={[styles.ringNumber, { color: ringColor }]}>{Math.abs(days)}</Text>
            <Text style={styles.ringLabel}>{days < 0 ? 'באיחור' : 'ימים'}</Text>
          </Ring>
        </View>
        <View style={styles.serviceMeta}>
          <Text style={type.label}>חידוש {formatDate(service.renewal_date)}</Text>
          <Text style={type.label}>
            {formatMoney(service.price_agorot * service.quantity)} · {CYCLE_NAMES[service.cycle]}
            {service.quantity > 1 ? ` · ${service.quantity} יח׳` : ''}
          </Text>
        </View>
      </Press>
      {status !== 'paid' ? (
        <Button
          title="סמן כשולם"
          icon="check"
          big
          onPress={() => markPaid.mutate(service)}
          loading={markPaid.isPending}
          disabled={!canMutate}
          style={{ marginTop: space.md }}
        />
      ) : null}
      {markPaid.isError ? <Text style={[type.small, { color: colors.unpaid }]}>{markPaid.error.message}</Text> : null}
    </Card>
  );
}

export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const detail = useClientDetail(clientId);
  const canMutate = useCanMutate();
  const data = detail.data;

  return (
    <Screen refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
      <Header
        right={
          <IconButton
            icon="edit"
            label="עריכת לקוח"
            disabled={!canMutate || !data}
            onPress={() => router.push(`/client/${clientId}/edit`)}
          />
        }
      />
      {!data ? (
        <Text style={type.label}>{detail.isPending ? 'טוען…' : 'הלקוח לא נמצא'}</Text>
      ) : (
        <>
          <Text style={type.screenTitle}>{data.client.name}</Text>
          <View style={styles.subRow}>
            {data.client.phone ? (
              <Press
                onPress={() => void Linking.openURL(`tel:${data.client.phone}`)}
                accessibilityRole="link"
                accessibilityLabel={`התקשר ל${data.client.name}`}
                style={styles.phone}
              >
                <Icon name="phone" size={18} color={colors.accent} />
                <Text style={styles.phoneText}>{data.client.phone}</Text>
              </Press>
            ) : null}
            <StatusChip updatedAt={detail.dataUpdatedAt} fetching={detail.isFetching} />
          </View>
          {data.client.note ? <Text style={[type.body, { color: colors.muted }]}>{data.client.note}</Text> : null}

          <SectionTitle
            action={
              <Button
                title="שירות"
                icon="plus"
                variant="secondary"
                disabled={!canMutate || data.client.archived_at !== null}
                onPress={() => router.push(`/service/new?clientId=${clientId}`)}
              />
            }
          >
            שירותים
          </SectionTitle>
          {data.services.length === 0 ? (
            <Empty icon="calendar" title="אין שירותים פעילים" />
          ) : (
            <View style={{ gap: space.md }}>
              {data.services.map((s) => (
                <ServiceCard key={s.id} service={s} clientId={clientId} />
              ))}
            </View>
          )}

          <SectionTitle>היסטוריה</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {data.history.length === 0 ? (
              <Text style={[type.label, { paddingVertical: space.sm }]}>עוד אין פעולות</Text>
            ) : (
              data.history.map((h, i) => (
                <View key={h.id} style={[styles.historyRow, i > 0 && styles.historyBorder]}>
                  <Text style={[type.body, { flex: 1 }]}>{h.text}</Text>
                  <Text style={type.small}>{formatDate(israelDate(new Date(h.created_at)))}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap', marginVertical: space.md },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.pendingBg,
  },
  phoneText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.accent, writingDirection: 'ltr' },
  serviceCard: { gap: space.sm },
  serviceTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  typeBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.row,
    backgroundColor: colors.pendingBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumber: { fontFamily: fonts.title, fontSize: 20, lineHeight: 24 },
  ringLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted },
  serviceMeta: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.border },
});
