/** Lists show relative time; detail screens show the absolute date (docs/04 §3). */
export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (Number.isNaN(diffSeconds)) return '';
  if (diffSeconds < 60) return 'just now';

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return formatDate(isoDate);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDate(isoDate)}, ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function formatCoordinates(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null || longitude === null) return null;
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
