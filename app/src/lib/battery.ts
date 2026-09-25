import { Linking, Platform } from 'react-native';

/** Opens Android's battery-optimization list so the owner can exempt the app. */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}
