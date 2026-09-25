import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, MAX_WEB_WIDTH, space } from './theme';

/** Subtle amber glow at the top of every screen (18% → transparent). */
export function Glow() {
  const { width } = useWindowDimensions();
  const height = 420;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="0%" rx="75%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={colors.glow} stopOpacity={0.18} />
            <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

interface Props {
  children: ReactNode;
  /** Pinned under the scroll content (e.g. the floating + button). */
  overlay?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}

/** Screen shell: background, glow, safe areas, pull-to-refresh, centered 560px column on web. */
export function Screen({ children, overlay, refreshing, onRefresh, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.column, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + 120 }]}>
      {children}
    </View>
  );
  return (
    <View style={styles.root}>
      <Glow />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
                progressBackgroundColor={colors.card}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {overlay ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
          <View pointerEvents="box-none" style={[styles.column, { flex: 1, paddingBottom: insets.bottom }]}>
            {overlay}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: MAX_WEB_WIDTH, alignSelf: 'center', paddingHorizontal: space.lg },
  overlay: { alignItems: 'stretch' },
});
