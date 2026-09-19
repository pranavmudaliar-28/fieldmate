import { formatCoordinates, formatDateTime, formatRelativeTime } from './format';

const now = new Date('2026-09-19T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it.each([
    ['2026-09-19T11:59:30.000Z', 'just now'],
    ['2026-09-19T11:30:00.000Z', '30m ago'],
    ['2026-09-19T10:00:00.000Z', '2h ago'],
    ['2026-09-18T10:00:00.000Z', 'yesterday'],
    ['2026-09-16T12:00:00.000Z', '3d ago'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatRelativeTime(input, now)).toBe(expected);
  });

  it('falls back to a date for anything older than a week', () => {
    expect(formatRelativeTime('2026-08-01T12:00:00.000Z', now)).toMatch(/2026/);
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});

describe('formatDateTime and coordinates', () => {
  it('includes the date and a time', () => {
    const formatted = formatDateTime('2026-09-16T09:12:00.000Z');
    expect(formatted).toMatch(/2026/);
    expect(formatted).toContain(',');
  });

  it('formats a coordinate pair, or nothing when missing', () => {
    expect(formatCoordinates(-33.8688, 151.2093)).toBe('-33.8688, 151.2093');
    expect(formatCoordinates(null, null)).toBeNull();
    expect(formatCoordinates(-33.8688, null)).toBeNull();
  });
});
