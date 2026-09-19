import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DashboardHeader } from '../../src/components/DashboardHeader';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../src/constants/theme';
import { useAuth } from '../../src/features/auth/auth-context';

/** S-006 Worker Dashboard — shell only; assigned tasks arrive in 6E. */
export default function WorkerDashboard() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <DashboardHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.greeting}
          accessibilityRole="header"
        >
          Hello, {user?.name.split(' ')[0] ?? 'there'}
        </Text>
        <View testID="worker-dashboard-placeholder">
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
            Your assigned tasks arrive in the next module.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.md },
  greeting: { ...typography.screenTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
});
