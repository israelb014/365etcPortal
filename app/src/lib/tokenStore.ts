import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The app's bearer token lives in the Android keystore (expo-secure-store).
 * The web app uses an HttpOnly cookie instead, so nothing is stored there.
 */
const KEY = 'session_token';
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  cached = token;
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
