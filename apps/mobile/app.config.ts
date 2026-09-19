import type { ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV ?? 'development') as AppEnv;
if (!['development', 'staging', 'production'].includes(APP_ENV)) {
  throw new Error(`Invalid APP_ENV "${APP_ENV}". Use development, staging or production.`);
}

const BASE_ID = 'com.slasheasy.fieldmate';

const variants: Record<AppEnv, { name: string; id: string; scheme: string }> = {
  development: { name: 'FieldMate Dev', id: `${BASE_ID}.dev`, scheme: 'fieldmate-dev' },
  staging: { name: 'FieldMate Staging', id: `${BASE_ID}.staging`, scheme: 'fieldmate-staging' },
  production: { name: 'FieldMate', id: BASE_ID, scheme: 'fieldmate' },
};

const variant = variants[APP_ENV];

const config: ExpoConfig = {
  name: variant.name,
  slug: 'fieldmate',
  scheme: variant.scheme,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: variant.id,
    supportsTablet: false,
  },
  android: {
    package: variant.id,
    adaptiveIcon: {
      backgroundColor: '#2563EB',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'FieldMate uses the camera to capture photo evidence for your tasks.',
        // Photos only: no microphone or audio recording permission.
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'FieldMate uses your location only when you tap "Use current location" while creating a task.',
      },
    ],
    'expo-notifications',
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
};

export default config;
