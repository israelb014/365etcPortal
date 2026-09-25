import { isUpdateRequired } from '@renewals/shared';
import { Linking, Platform } from 'react-native';
import { APP_VERSION } from '../lib/config';
import { useVersion } from '../lib/hooks';
import { Banner } from './parts';

/** "יש גרסה חדשה" when the server needs a newer app. Web is always current. */
export function UpdateBanner() {
  const { data } = useVersion();
  if (Platform.OS === 'web' || !data || !isUpdateRequired(APP_VERSION, data.min_app_version)) return null;
  const url = data.apk_url;
  return (
    <Banner
      icon="download"
      text="יש גרסה חדשה"
      action={url ? 'הורדה' : undefined}
      onPress={url ? () => void Linking.openURL(url) : undefined}
    />
  );
}
