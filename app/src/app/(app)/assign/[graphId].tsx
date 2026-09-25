import type { Client } from '@renewals/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useLinkMsUser, useMsUser } from '../../../lib/hooks';
import { useCanMutate } from '../../../lib/online';
import { Button } from '../../../ui/Button';
import { Header } from '../../../ui/Header';
import { Icon } from '../../../ui/Icon';
import { Avatar, Card, SectionTitle } from '../../../ui/parts';
import { Press } from '../../../ui/Press';
import { Screen } from '../../../ui/Screen';
import { colors, radius, space, type } from '../../../ui/theme';

function ClientOption({ client, onPress, disabled }: { client: Client; onPress: () => void; disabled: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={client.name} style={styles.option}>
      <Avatar name={client.name} size={40} />
      <Text style={[type.bodyStrong, { flex: 1 }]}>{client.name}</Text>
      <Icon name="link" size={18} color={colors.accent} />
    </Press>
  );
}

/** "למי שייך?" — one tap links a Microsoft user to a client. */
export default function AssignUser() {
  const { graphId } = useLocalSearchParams<{ graphId: string }>();
  const detail = useMsUser(graphId);
  const link = useLinkMsUser(graphId);
  const canMutate = useCanMutate();
  const data = detail.data;
  const disabled = !canMutate || link.isPending;
  const done = (clientId: number) => router.replace(`/client/${clientId}`);
  const suggestedIds = new Set(data?.suggestions.map((c) => c.id));

  return (
    <Screen>
      <Header title="למי שייך?" fallback="/assign" />
      {!data ? (
        <Text style={type.label}>{detail.isPending ? 'טוען…' : 'המשתמש לא נמצא'}</Text>
      ) : (
        <>
          <Card style={styles.userCard}>
            <Avatar name={data.user.display_name} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.sectionTitle}>{data.user.display_name}</Text>
              <Text style={[type.label, { writingDirection: 'ltr', textAlign: 'right' }]}>{data.user.upn}</Text>
              {data.licenses.length > 0 ? <Text style={type.small}>{data.licenses.join(' · ')}</Text> : null}
            </View>
          </Card>
          {link.isError ? <Text style={[type.label, { color: colors.unpaid }]}>{link.error.message}</Text> : null}

          {data.suggestions.length > 0 ? (
            <>
              <SectionTitle>הצעות</SectionTitle>
              <View style={{ gap: space.sm }}>
                {data.suggestions.map((c) => (
                  <ClientOption
                    key={c.id}
                    client={c}
                    disabled={disabled}
                    onPress={() => link.mutate({ client_id: c.id }, { onSuccess: () => done(c.id) })}
                  />
                ))}
              </View>
            </>
          ) : null}

          <SectionTitle>כל הלקוחות</SectionTitle>
          <View style={{ gap: space.sm }}>
            {data.clients
              .filter((c) => !suggestedIds.has(c.id))
              .map((c) => (
                <ClientOption
                  key={c.id}
                  client={c}
                  disabled={disabled}
                  onPress={() => link.mutate({ client_id: c.id }, { onSuccess: () => done(c.id) })}
                />
              ))}
          </View>

          <Button
            title="לקוח חדש"
            icon="userPlus"
            variant="secondary"
            big
            disabled={disabled}
            style={{ marginTop: space.xl }}
            onPress={() =>
              link.mutate({ new_client_name: data.user.display_name }, { onSuccess: (r) => done(r.client_id) })
            }
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 64,
  },
});
