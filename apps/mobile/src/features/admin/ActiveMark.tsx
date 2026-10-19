import { StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  toneColors,
  typography,
} from '../../constants/theme';

/** A filled dot for active, a hollow one for inactive, and always the word. */
export function ActiveMark({ active, testID }: { active: boolean; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.text, { color: active ? toneColors.success.text : colors.textSecondary }]}
      >
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  dotOn: { backgroundColor: toneColors.success.dot },
  dotOff: { borderWidth: 1.5, borderColor: colors.textSecondary },
  text: { ...typography.secondaryStrong },
});
