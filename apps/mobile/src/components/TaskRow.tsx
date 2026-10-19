import type { TaskStatus } from '@fieldmate/shared';
import { Children, Fragment, memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  radius,
  spacing,
  statusAppearance,
  typography,
} from '../constants/theme';
import { Icon } from './Icon';

export type TaskRowProps = {
  title: string;
  status: TaskStatus;
  /** Written after the status word: a worker, a place or a time. */
  detail?: string;
  /** Overrides the status word, e.g. "In progress · Changes requested". */
  statusLabel?: string;
  onPress: () => void;
  testID?: string;
};

/**
 * One line of a grouped list: the status icon on its tint, the title, and
 * "Status · detail" with the status word in its own colour. Status is the
 * icon, the colour and the word, so it never rests on colour alone.
 */
function TaskRowComponent({ title, status, detail, statusLabel, onPress, testID }: TaskRowProps) {
  const appearance = statusAppearance[status];
  const word = statusLabel ?? appearance.label;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, `status ${word}`, detail].filter(Boolean).join(', ')}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.emblem, { backgroundColor: appearance.tint }]}>
        <Icon name={appearance.icon} size={20} color={appearance.text} />
      </View>
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.meta}
        >
          <Text style={[styles.status, { color: appearance.text }]}>{word}</Text>
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

export const TaskRow = memo(TaskRowComponent);

/** A card holding rows, divided by hairlines. */
export function RowGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...elevation.card,
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smPlus,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  emblem: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  meta: { ...typography.caption, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  status: { fontFamily: typography.secondaryStrong.fontFamily },
});
