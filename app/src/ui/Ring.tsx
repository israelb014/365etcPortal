import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from './theme';

interface Props {
  size: number;
  stroke?: number;
  /** 0..1 */
  progress: number;
  color: string;
  children?: ReactNode;
  label?: string;
}

/** Circular progress (used instead of progress bars). Starts at 12 o'clock. */
export function Ring({ size, stroke = 8, progress, color, children, label }: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const raw = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  // A tiny value still shows as a short arc rather than a dot.
  const p = raw > 0 ? Math.max(raw, 0.05) : 0;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={label}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.ringTrack} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
