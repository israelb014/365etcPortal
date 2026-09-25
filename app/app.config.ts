import fs from 'node:fs';
import path from 'node:path';
import type { ExpoConfig } from 'expo/config';

// Build-time settings. EAS reads these from eas.json / EAS environment variables.
const APP_URL = (process.env.APP_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const googleServices = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const hasGoogleServices = fs.existsSync(path.resolve(__dirname, googleServices));

const config: ExpoConfig = {
  name: 'חידושים',
  slug: 'renewals',
  // 'com.ibfix.renewals' receives the Google sign-in redirect (com.ibfix.renewals:/oauthredirect).
  scheme: ['renewals', 'com.ibfix.renewals'],
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0F1216',
  android: {
    package: 'com.ibfix.renewals',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#0F1216',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    ...(hasGoogleServices ? { googleServicesFile: googleServices } : {}),
    permissions: ['POST_NOTIFICATIONS'],
    predictiveBackGestureEnabled: false,
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    ['expo-localization', { supportsRTL: true, forcesRTL: true }],
    ['expo-notifications', { color: '#F0A23B' }],
  ],
  extra: {
    apiUrl: APP_URL,
    googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
};

export default config;
