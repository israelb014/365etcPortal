import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  apiUrl?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
  eas?: { projectId?: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Web is served by the same Worker, so it uses relative URLs. */
export const API_URL = Platform.OS === 'web' ? '' : (extra.apiUrl ?? '');
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const GOOGLE_ANDROID_CLIENT_ID = extra.googleAndroidClientId ?? '';
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';
export const EAS_PROJECT_ID = extra.eas?.projectId ?? '';
export const IS_WEB = Platform.OS === 'web';
