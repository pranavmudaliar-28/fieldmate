import { describe, expect, it } from '@jest/globals';
import { AppError } from './app-error.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const cursor = {
  updatedAt: new Date('2026-09-16T09:12:00.000Z'),
  id: '3f1c2a7e-8b4d-4c1e-9a2b-6d5e4f3a2b1c',
};

describe('pagination cursor', () => {
  it('round-trips a cursor', () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('is opaque (no readable timestamp or id)', () => {
    const encoded = encodeCursor(cursor);
    expect(encoded).not.toContain('2026');
    expect(encoded).not.toContain(cursor.id);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['empty', ''],
    ['not base64', '!!!'],
    ['missing id', Buffer.from('2026-09-16T09:12:00.000Z').toString('base64url')],
    ['bad date', Buffer.from(`nonsense|${cursor.id}`).toString('base64url')],
    ['bad id', Buffer.from('2026-09-16T09:12:00.000Z|not-a-uuid').toString('base64url')],
    [
      'extra parts',
      Buffer.from(`2026-09-16T09:12:00.000Z|${cursor.id}|extra`).toString('base64url'),
    ],
  ])('rejects an invalid cursor (%s)', (_case, value) => {
    expect(() => decodeCursor(value)).toThrow(AppError);
    try {
      decodeCursor(value);
    } catch (error) {
      expect((error as AppError).code).toBe('INVALID_REQUEST');
      expect((error as AppError).status).toBe(400);
    }
  });
});
