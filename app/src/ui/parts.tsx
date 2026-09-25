import { STATUS_NAMES, type Status } from '@renewals/shared';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Press } from './Press';
import { colors, fonts, MIN_TOUCH, radius, space, statusColors, type } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ status }: { status: Status }) {
  const c = statusColors[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{STATUS_NAMES[status]}</Text>
    </View>
  );
}

export function Chip({ icon, text, tone = 'muted' }: { icon?: IconName; text: string; tone?: 'muted' | 'warn' }) {
  const fg = tone === 'warn' ? colors.pending : colors.muted;
  return (
    <View style={[styles.chip, tone === 'warn' && { backgroundColor: colors.pendingBg, borderColor: 'transparent' }]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, color = colors.accent }: { name: string; size?: number; color?: string }) {
  const letter = name.trim().charAt(0) || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderColor: color }]}>
      <Text style={[styles.avatarText, { color, fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Banner({
  icon,
  text,
  action,
  onPress,
  tone = 'accent',
}: {
  icon: IconName;
  text: string;
  action?: string;
  onPress?: () => void;
  tone?: 'accent' | 'danger';
}) {
  const fg = tone === 'danger' ? colors.unpaid : colors.pending;
  const bg = tone === 'danger' ? colors.unpaidBg : colors.pendingBg;
  const body = (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Icon name={icon} color={fg} />
      <Text style={[type.bodyStrong, { color: fg, flex: 1 }]}>{text}</Text>
      {action ? <Text style={[styles.bannerAction, { color: fg }]}>{action}</Text> : null}
      {onPress ? <Icon name="chevron" color={fg} size={18} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={text}>
      {body}
    </Press>
  );
}

export function Fab({ onPress, label, disabled }: { onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <View pointerEvents="box-none" style={styles.fabWrap}>
      <Press
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.fab}
        scaleTo={0.92}
      >
        <Icon name="plus" size={28} color={colors.accentText} strokeWidth={2.5} />
      </Press>
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={[type.sectionTitle, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.label, { textAlign: 'center' }]}>{text}</Text> : null}
    </View>
  );
}

export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Press
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={styles.toggleHit}
    >
      <View style={[styles.toggle, value && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  pill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17 },
  avatar: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pendingBg,
  },
  avatarText: { fontFamily: fonts.title },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.row,
    padding: space.lg,
    minHeight: MIN_TOUCH + 12,
  },
  bannerAction: { fontFamily: fonts.bodyBold, fontSize: 15 },
  fabWrap: { position: 'absolute', bottom: space.xl, left: space.lg },
  fab: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.pendingBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  toggleHit: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center' },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.ringTrack,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  knob: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.text },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
});
