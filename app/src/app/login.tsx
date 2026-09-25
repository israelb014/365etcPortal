import * as Google from 'expo-auth-session/providers/google';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../lib/config';
import { useIsOnline } from '../lib/online';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { colors, fonts, radius, space, type } from '../ui/theme';

WebBrowser.maybeCompleteAuthSession();

const ERRORS: Record<string, string> = {
  denied: 'אין הרשאה',
  failed: 'הכניסה נכשלה, נסה שוב',
};

function NativeGoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signIn } = useAuth();
  const online = useIsOnline();
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response) setBusy(false);
      return;
    }
    const idToken = response.params.id_token ?? response.authentication?.idToken;
    if (!idToken) {
      onError(ERRORS.failed!);
      setBusy(false);
      return;
    }
    api<{ token: string }>('/api/v1/auth/google', { method: 'POST', body: { idToken }, noAuthRedirect: true })
      .then(({ token }) => signIn(token))
      .catch((e: unknown) => {
        onError(e instanceof ApiError && e.status === 403 ? ERRORS.denied! : ERRORS.failed!);
        setBusy(false);
      });
  }, [response, signIn, onError]);

  return (
    <Button
      title="כניסה עם Google"
      icon="login"
      big
      loading={busy}
      disabled={!request || !online}
      onPress={() => {
        onError('');
        setBusy(true);
        void promptAsync();
      }}
    />
  );
}

export default function Login() {
  const params = useLocalSearchParams<{ error?: string }>();
  const [error, setError] = useState(params.error ? (ERRORS[params.error] ?? ERRORS.failed!) : '');

  return (
    <Screen scroll={false}>
      <View style={styles.wrap}>
        <View style={styles.mark}>
          <Icon name="calendar" size={40} color={colors.accent} />
        </View>
        <Text style={[type.screenTitle, styles.center]}>חידושים</Text>
        <Text style={[type.body, styles.center, { color: colors.muted }]}>
          מעקב אחרי חידושים, מחירים ותשלומים של הלקוחות
        </Text>
        <View style={{ height: space.xl }} />
        {Platform.OS === 'web' ? (
          <Button
            title="כניסה עם Google"
            icon="login"
            big
            onPress={() => {
              window.location.href = '/auth/google/start';
            }}
          />
        ) : (
          <NativeGoogleButton onError={setError} />
        )}
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Icon name="alert" size={18} color={colors.unpaid} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 560, justifyContent: 'center', gap: space.md },
  center: { textAlign: 'center' },
  mark: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  error: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.unpaidBg,
    borderRadius: radius.row,
    padding: space.md,
  },
  errorText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.unpaid },
});
