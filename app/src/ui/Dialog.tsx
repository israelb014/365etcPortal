import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radius, space, type } from './theme';

/** Confirmation sheet (works the same on Android and web, unlike Alert). */
export function ConfirmDialog({
  visible,
  title,
  text,
  confirm,
  onConfirm,
  onCancel,
  busy,
}: {
  visible: boolean;
  title: string;
  text?: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={type.sectionTitle}>{title}</Text>
          {text ? <Text style={[type.body, { color: colors.muted }]}>{text}</Text> : null}
          <View style={styles.actions}>
            <Button title={confirm} variant="danger" onPress={onConfirm} loading={busy} style={{ flex: 1 }} />
            <Button title="ביטול" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: space.xl },
  sheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    gap: space.md,
  },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
});
