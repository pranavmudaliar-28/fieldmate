import Constants from 'expo-constants';

export type MobileAppEnv = 'development' | 'staging' | 'production';

function readApiBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set. See apps/mobile/.env.example.');
  }
  return value.replace(/\/+$/, '');
}

export const env = {
  appEnv: (Constants.expoConfig?.extra?.appEnv as MobileAppEnv | undefined) ?? 'development',
  get apiBaseUrl(): string {
    return readApiBaseUrl();
  },
};
