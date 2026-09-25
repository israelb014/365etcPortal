import { Assistant_400Regular, Assistant_600SemiBold, Assistant_700Bold } from '@expo-google-fonts/assistant';
import { Rubik_700Bold, Rubik_800ExtraBold } from '@expo-google-fonts/rubik';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { applyRtl } from '../lib/rtl';
import { colors } from '../ui/theme';

applyRtl();

export default function RootLayout() {
  const [loaded] = useFonts({
    Rubik_700Bold,
    Rubik_800ExtraBold,
    Assistant_400Regular,
    Assistant_600SemiBold,
    Assistant_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
