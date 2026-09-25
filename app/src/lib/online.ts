import NetInfo from '@react-native-community/netinfo';
import { onlineManager, useIsRestoring } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Wires NetInfo into react-query so queries pause and resume with the network. */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/**
 * Whether buttons that change data may be used. Offline, every mutation is
 * disabled: the app shows the cached data read-only.
 */
export function useCanMutate(): boolean {
  const online = useIsOnline();
  const restoring = useIsRestoring();
  return online && !restoring;
}
