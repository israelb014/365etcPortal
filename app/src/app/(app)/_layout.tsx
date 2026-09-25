import { Stack } from 'expo-router';
import { NativeEffects } from '../../lib/NativeEffects';
import { useReducedMotion } from '../../ui/motion';
import { colors } from '../../ui/theme';

export default function AppLayout() {
  const reduced = useReducedMotion();
  return (
    <>
      <NativeEffects />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: reduced ? 'none' : 'fade',
          animationDuration: 220,
        }}
      />
    </>
  );
}
