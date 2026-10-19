import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';

export type Choice<T extends string> = {
  value: T;
  label: string;
  description?: string;
  testID?: string;
};

export type ChoiceListProps<T extends string> = {
  choices: Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * Radio cards: one choice from a short list, each a full-width 56 target.
 * The selected card is outlined in ink and filled, so it reads without colour.
 */
export function ChoiceList<T extends string>({
  choices,
  selected,
  onSelect,
  disabled = false,
  accessibilityLabel,
}: ChoiceListProps<T>) {
  return (
    <View
      style={styles.list}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {choices.map((choice) => {
        const isSelected = choice.value === selected;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onSelect(choice.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled }}
            accessibilityLabel={
              choice.description ? `${choice.label}, ${choice.description}` : choice.label
            }
            testID={choice.testID}
            style={({ pressed }) => [
              styles.option,
              isSelected && styles.optionSelected,
              pressed && !isSelected && styles.optionPressed,
            ]}
          >
            <View style={[styles.radio, isSelected && styles.radioSelected]}>
              {isSelected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.text}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
                {choice.label}
              </Text>
              {choice.description ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.description}>
                  {choice.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: layout.buttonHeightLarge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smPlus,
    borderRadius: radius.action,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.background },
  optionPressed: { backgroundColor: colors.background },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.primary },
  text: { flex: 1, gap: 2 },
  label: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  description: { ...typography.secondary, color: colors.textSecondary },
});
