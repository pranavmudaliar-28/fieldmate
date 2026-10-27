import type { ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV ?? 'development') as AppEnv;
if (!['development', 'staging', 'production'].includes(APP_ENV)) {
  throw new Error(`Invalid APP_ENV "${APP_ENV}". Use development, staging or production.`);
}

const BASE_ID = 'com.slasheasy.fieldmate';

const variants: Record<AppEnv, { name: string; id: string; scheme: string }> = {
  development: { name: 'FieldMate Dev', id: `${BASE_ID}.dev`, scheme: 'fieldmate-dev' },
  staging: { name: 'FieldMate', id: `${BASE_ID}.staging`, scheme: 'fieldmate-staging' },
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
      // Signal yellow behind the ink pin, as in the iOS icon.
      backgroundColor: '#FFC21A',
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
    'expo-font',
    [
      'expo-notifications',
      {
        // Android draws the status-bar icon from alpha only, so the full-colour
        // app icon would show as a grey square: the white pin glyph is used.
        icon: './assets/android-icon-monochrome.png',
        color: '#0F1115',
      },
    ],
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        // The logo tile on ink. The app then draws the full splash (rings,
        // wordmark, tagline) at the same place while the session is checked.
        image: './assets/splash-icon.png',
        imageWidth: 136,
        resizeMode: 'contain',
        backgroundColor: '#0F1115',
      },
    ],
  ],
  web: {
    bundler: 'metro',
    // A router-driven app: every route is served by one document.
    output: 'single',
    favicon: './assets/favicon.png',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
};

export default config;
