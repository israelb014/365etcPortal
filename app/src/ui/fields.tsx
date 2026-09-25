import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Press } from './Press';
import { colors, fonts, MIN_TOUCH, radius, space, type } from './theme';

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string | null; suffix?: ReactNode };

export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, hint, error, suffix, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && { borderColor: colors.accent },
          error ? { borderColor: colors.unpaid } : null,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {suffix}
      </View>
      {error ? <Text style={[type.small, { color: colors.unpaid }]}>{error}</Text> : null}
      {!error && hint ? <Text style={type.small}>{hint}</Text> : null}
    </View>
  );
});

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <View style={styles.segment}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Press
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, active && { color: colors.accentText }]}>{o.label}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: space.lg },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: MIN_TOUCH + 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    paddingVertical: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
    // The wrapper shows focus (amber border); drop the browser's own outline.
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, minHeight: MIN_TOUCH, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted },
});
