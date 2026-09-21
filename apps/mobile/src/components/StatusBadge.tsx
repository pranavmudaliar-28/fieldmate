import type { TaskStatus } from '@fieldmate/shared';
import { statusAppearance } from '../constants/theme';
import { Badge } from './Badge';

/**
 * Icon plus the word on a tint (docs/04 §2.2), so status survives sunlight,
 * colour blindness and a greyscale screenshot. A dot as well was one signal too
 * many — the card's stripe already repeats the colour.
 */
export function StatusBadge({ status }: { status: TaskStatus }) {
  const appearance = statusAppearance[status];

  return (
    <Badge
      label={appearance.label}
      tone={appearance.tone}
      icon={appearance.icon}
      accessibilityLabel={`Status: ${appearance.label}`}
      testID={`status-badge-${status}`}
    />
  );
}
