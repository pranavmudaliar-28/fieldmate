import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';
import { Icon } from './Icon';

/** Above this the exact number stops being useful and starts breaking the pill. */
const MAX_SHOWN = 99;

export type NotificationBellProps = {
  unread: number;
  onPress: () => void;
  testID?: string;
};

/**
 * The way into the inbox, from any header. It is a header action rather than a
 * fourth tab because every role's tab bar is three items by design (docs/04 §4).
 */
export function NotificationBell({ unread, onPress, testID }: NotificationBellProps) {
  const has = unread > 0;
  const shown = unread > MAX_SHOWN ? `${MAX_SHOWN}+` : String(unread);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The count belongs in the label: a badge is invisible to a screen reader.
      accessibilityLabel={has ? `Notifications, ${unread} unread` : 'Notifications, nothing unread'}
      testID={testID ?? 'notification-bell'}
      style={styles.button}
    >
      <Icon name="notifications-outline" size={24} />
      {has ? (
        <View style={styles.badge} pointerEvents="none" testID="notification-badge">
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.count}
            numberOfLines={1}
          >
            {shown}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.minTouchTarget + 8,
    height: layout.minTouchTarget + 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -spacing.xs,
    right: -spacing.xs,
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    // Separates the badge from whatever the icon is sitting on.
    borderWidth: 2,
    borderColor: colors.surface,
  },
  count: {
    // Caption is the floor the system sets: nothing below 13px, including
    // a count a worker reads at arm's length in sunlight.
    ...typography.caption,
    fontFamily: typography.secondaryStrong.fontFamily,
    color: colors.onPrimary,
  },
});
