import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Press } from './Press';
import { colors, fonts, MIN_TOUCH, radius } from './theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  big?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  secondary: { bg: colors.card, fg: colors.text, border: colors.border },
  danger: { bg: colors.unpaidBg, fg: colors.unpaid, border: 'transparent' },
  ghost: { bg: 'transparent', fg: colors.muted, border: 'transparent' },
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, big, style, testID }: Props) {
  const p = palette[variant];
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: p.bg, borderColor: p.border, minHeight: big ? 56 : MIN_TOUCH + 4 },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {icon ? <Icon name={icon} color={p.fg} size={big ? 22 : 20} /> : null}
            <Text style={[styles.text, { color: p.fg, fontSize: big ? 18 : 16 }]}>{title}</Text>
          </>
        )}
      </View>
    </Press>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  disabled,
  color = colors.text,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.iconButton}
    >
      <Icon name={icon} color={color} />
    </Press>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.row,
    borderWidth: 1,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontFamily: fonts.bodyBold },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
