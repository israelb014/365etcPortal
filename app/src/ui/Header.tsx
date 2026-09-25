import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from './Button';
import { space, type } from './theme';

/** Back button + big title. */
export function Header({ title, right, fallback = '/' }: { title?: string; right?: ReactNode; fallback?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <IconButton
          icon="back"
          label="חזרה"
          onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
        />
        <View style={styles.right}>{right}</View>
      </View>
      {title ? <Text style={type.screenTitle}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, marginBottom: space.lg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  right: { flexDirection: 'row', gap: space.sm },
});
