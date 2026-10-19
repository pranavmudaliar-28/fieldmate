import type { TaskStatus } from '@fieldmate/shared';
import { statusAppearance } from '../constants/theme';
import { Badge } from './Badge';

/**
 * Icon plus the word on the status's own tint, so status survives sunlight,
 * colour blindness and a greyscale screenshot.
 */
export function StatusBadge({ status, label }: { status: TaskStatus; label?: string }) {
  const appearance = statusAppearance[status];
  const text = label ?? appearance.label;

  return (
    <Badge
      label={text}
      palette={appearance}
      icon={appearance.icon}
      accessibilityLabel={`Status: ${text}`}
      testID={`status-badge-${status}`}
    />
  );
}
