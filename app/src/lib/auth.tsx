import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, onUnauthorized } from './api';
import { unregisterPush } from './push';
import { persister, queryClient } from './query';
import { getToken, setToken } from './tokenStore';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  /** App: stores the bearer token from the server. Web: marks the cookie session as present. */
  signIn(token: string | null): Promise<void>;
  signOut(options?: { remote?: boolean }): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Web keeps no token (HttpOnly cookie); this flag only lets it open offline without a round trip. */
const WEB_FLAG = 'signed_in';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const signedIn =
        Platform.OS === 'web' ? (await AsyncStorage.getItem(WEB_FLAG)) === '1' : Boolean(await getToken());
      if (alive) setStatus(signedIn ? 'signedIn' : 'signedOut');
    })().catch(() => alive && setStatus('signedOut'));
    return () => {
      alive = false;
    };
  }, []);

  const clearLocal = useCallback(async () => {
    await setToken(null);
    await AsyncStorage.removeItem(WEB_FLAG);
    queryClient.clear();
    await persister.removeClient();
    setStatus('signedOut');
  }, []);

  const signIn = useCallback(async (token: string | null) => {
    if (token) await setToken(token);
    if (Platform.OS === 'web') await AsyncStorage.setItem(WEB_FLAG, '1');
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(
    async ({ remote = true }: { remote?: boolean } = {}) => {
      if (remote) {
        await unregisterPush().catch(() => undefined);
        await api('/api/v1/auth/logout', { method: 'POST', noAuthRedirect: true }).catch(() => undefined);
      }
      await clearLocal();
    },
    [clearLocal],
  );

  useEffect(() => onUnauthorized(() => void clearLocal()), [clearLocal]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
