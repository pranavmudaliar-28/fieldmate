import type { TaskStatus } from '@fieldmate/shared';
import { statusAppearance } from '../constants/theme';
import { Badge } from './Badge';

/**
 * Icon plus the word on the status's own tint, so status survives sunlight,
 * colour blindness and a greyscale screenshot.
 */
export function StatusBadge({
  status,
  label,
  size,
}: {
  status: TaskStatus;
  label?: string;
  size?: 'list' | 'detail';
}) {
  const appearance = statusAppearance[status];
  const text = label ?? appearance.label;

  return (
    <Badge
      label={text}
      palette={appearance}
      icon={appearance.icon}
      {...(size ? { size } : {})}
      accessibilityLabel={`Status: ${text}`}
      testID={`status-badge-${status}`}
    />
  );
}
