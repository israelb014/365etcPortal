import { I18nManager, Platform } from 'react-native';

/**
 * Forces right-to-left layout. On Android the expo-localization plugin
 * (`forcesRTL`) already applies RTL natively before JS starts, so the app never
 * needs a reload in practice; `forceRTL` here also persists it for the next
 * launch. `needsRtlRestart()` reports the rare one-time case where the running
 * process is still LTR.
 */
export function applyRtl(): void {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'he';
    }
    return;
  }
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export function needsRtlRestart(): boolean {
  return Platform.OS !== 'web' && !I18nManager.isRTL;
}
