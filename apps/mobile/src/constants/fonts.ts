import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';

/**
 * The Geist weights the type scale uses, plus Geist Mono for times and
 * counts. Keys must match the `fontFamily` values in theme.ts, because React
 * Native resolves a custom family by name and cannot synthesise the others
 * from one file. Imported per weight so the unused ones are not bundled.
 */
export const appFonts = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  GeistMono_500Medium,
};
