import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ToastProvider } from '../src/components/Toast';
import { interFonts } from '../src/constants/fonts';
import { colors, elevation, layout } from '../src/constants/theme';
import { AuthProvider } from '../src/features/auth/auth-context';
import { createQueryClient } from '../src/lib/query-client';

void SplashScreen.preventAutoHideAsync();

const styles = StyleSheet.create({
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    backgroundColor: colors.background,
    // Lifted off the backdrop rather than divided from it by a line: a border
    // down both sides reads as a seam, a shadow reads as a surface.
    ...elevation.floating,
  },
  full: { flex: 1 },
  /**
   * Seen either side of the column once the window is wider than it. Painted
   * here rather than as page CSS because `output: 'single'` serves Expo's own
   * HTML document and ignores a +html.tsx.
   */
  backdrop: { flex: 1, backgroundColor: colors.pageBackdrop },
});

/**
 * Everything the app draws, as one column.
 *
 * On a phone or tablet the column is simply the screen. A desktop browser
 * window is several times wider than anything the design was drawn for, and
 * stretching a one-column layout across it leaves inputs a metre wide, a tab
 * bar spanning the whole screen and a toast the width of the window. So on
 * web the column stops at its maximum width and centres over a deeper
 * backdrop.
 *
 * It wraps the offline banner and the toast as well as the routes, because
 * those sit outside the stack and would otherwise still span the window.
 *
 * Native keeps the plain full-bleed view: no screen is as wide as the maximum,
 * so the constraint would never bind.
 */
function AppColumn({ children }: PropsWithChildren) {
  if (Platform.OS !== 'web') return <View style={styles.full}>{children}</View>;

  return (
    <View style={styles.backdrop}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(interFonts);

  // A missing font file must not leave the user on a blank splash screen; the
  // system face is an acceptable fallback, an unstartable app is not.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppColumn>
            <ToastProvider>
              <StatusBar style="dark" />
              <OfflineBanner />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              />
            </ToastProvider>
          </AppColumn>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
