import { Assistant_400Regular } from '@expo-google-fonts/assistant/400Regular';
import { Assistant_600SemiBold } from '@expo-google-fonts/assistant/600SemiBold';
import { Assistant_700Bold } from '@expo-google-fonts/assistant/700Bold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { setupOnlineManager } from '../lib/online';
import { setupNotifications } from '../lib/push';
import { persistOptions, queryClient, setupFocusManager } from '../lib/query';
import { applyRtl, needsRtlRestart } from '../lib/rtl';
import { ErrorBoundary as AppErrorBoundary, ErrorScreen } from '../ui/ErrorBoundary';
import { useReducedMotion } from '../ui/motion';
import { colors, space, type } from '../ui/theme';

applyRtl();
setupOnlineManager();
setupNotifications();

/** Route-level errors (expo-router) show the same screen as the global boundary. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ErrorScreen onRetry={() => void retry()} />;
}

function Blank() {
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}

function RestartNeeded() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xxl, gap: space.md }}>
      <Text style={type.screenTitle}>עוד רגע</Text>
      <Text style={[type.body, { color: colors.muted }]}>
        צריך לסגור את האפליקציה ולפתוח אותה שוב כדי שהתצוגה תהיה מימין לשמאל. זה קורה רק פעם אחת.
      </Text>
    </View>
  );
}

function RootStack() {
  const { status } = useAuth();
  const reduced = useReducedMotion();
  if (status === 'loading') return <Blank />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: reduced ? 'none' : 'fade',
        animationDuration: 220,
      }}
    >
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_700Bold,
    Rubik_800ExtraBold,
    Assistant_400Regular,
    Assistant_600SemiBold,
    Assistant_700Bold,
  });
  useEffect(() => setupFocusManager(), []);

  if (!fontsLoaded && !fontError) return <Blank />;
  if (needsRtlRestart()) return <RestartNeeded />;
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <AppErrorBoundary>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </PersistQueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
