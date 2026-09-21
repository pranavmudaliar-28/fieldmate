import type { TaskStatus } from '@fieldmate/shared';
import { statusAppearance } from '../constants/theme';
import { Badge } from './Badge';

/**
 * Status is carried three ways — a dot, an icon and the word — so it survives
 * sunlight, colour blindness and a greyscale screenshot (docs/04 §2.2).
 */
export function StatusBadge({ status }: { status: TaskStatus }) {
  const appearance = statusAppearance[status];

  return (
    <Badge
      label={appearance.label}
      tone={appearance.tone}
      icon={appearance.icon}
      dot
      accessibilityLabel={`Status: ${appearance.label}`}
      testID={`status-badge-${status}`}
    />
  );
}
