import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { ApiError } from './api';
import { APP_VERSION } from './config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data immediately, refresh in the background.
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 30,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
    mutations: { networkMode: 'online', retry: false },
  },
});

/** The cache survives restarts, so the app opens with the last data even offline. */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'renewals-cache' });

export const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 30,
  buster: APP_VERSION,
};

/** Refresh when the app comes back to the foreground. */
export function setupFocusManager(): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}

export const keys = {
  snapshot: ['snapshot'] as const,
  client: (id: number) => ['client', id] as const,
  settings: ['settings'] as const,
  msUsers: ['ms-users'] as const,
  msUser: (graphId: string) => ['ms-user', graphId] as const,
  version: ['version'] as const,
};
