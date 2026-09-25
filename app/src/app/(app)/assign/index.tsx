import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useMsUsers } from '../../../lib/hooks';
import { Header } from '../../../ui/Header';
import { Icon } from '../../../ui/Icon';
import { Avatar, Empty } from '../../../ui/parts';
import { Press } from '../../../ui/Press';
import { Screen } from '../../../ui/Screen';
import { colors, radius, space, type } from '../../../ui/theme';

/** Microsoft users with a license that aren't linked to a client yet. */
export default function AssignList() {
  const users = useMsUsers();
  const pending = (users.data ?? []).filter((u) => u.client_id === null && u.sku_ids.length > 0);
  return (
    <Screen refreshing={users.isRefetching} onRefresh={() => void users.refetch()}>
      <Header title="למי שייך?" />
      {pending.length === 0 && !users.isPending ? (
        <Empty icon="check" title="כל המשתמשים משויכים" />
      ) : (
        <View style={{ gap: space.sm }}>
          {pending.map((u) => (
            <Press
              key={u.graph_id}
              onPress={() => router.push(`/assign/${encodeURIComponent(u.graph_id)}`)}
              accessibilityRole="button"
              style={styles.row}
            >
              <Avatar name={u.display_name} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{u.display_name}</Text>
                <Text style={[type.small, { writingDirection: 'ltr', textAlign: 'right' }]}>{u.upn}</Text>
              </View>
              <Icon name="chevron" color={colors.muted} size={18} />
            </Press>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
