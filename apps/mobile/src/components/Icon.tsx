import { Ionicons } from '@expo/vector-icons';
import { colors, type IconName } from '../constants/theme';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * The single place the app touches the icon set, so swapping it later is one
 * file. Icons are hidden from screen readers by default: every icon that
 * carries meaning sits beside a word that says the same thing (docs/04 §8), and
 * an icon-only control gets its label from the button wrapping it.
 */
export function Icon({ name, size = 20, color = colors.textPrimary, testID }: IconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
