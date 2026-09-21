import { describe, expect, it } from '@jest/globals';
import { FIELD_LIMITS } from './constants.js';
import {
  createNoteSchema,
  createTaskSchema,
  formatZodError,
  listTasksQuerySchema,
  listUsersQuerySchema,
  locationSchema,
  loginSchema,
  reassignTaskSchema,
  registerPushTokenSchema,
  rejectTaskSchema,
  updateTaskSchema,
} from './schemas.js';

const WORKER_ID = '3f1c2a7e-8b4d-4c1e-9a2b-6d5e4f3a2b1c';

const validTask = {
  title: 'Replace water meter',
  description: 'Old meter leaking.',
  workerId: WORKER_ID,
  location: { address: '14 Harbour Rd' },
};

describe('loginSchema', () => {
  it('trims and lowercases the email', () => {
    const parsed = loginSchema.parse({ email: '  Manager@FieldMate.dev ', password: 'secret' });
    expect(parsed.email).toBe('manager@fieldmate.dev');
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(formatZodError(result.error)).toBe('email: Enter a valid email address.');
  });

  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', role: 'MANAGER' }).success).toBe(
      false,
    );
  });
});

describe('createTaskSchema', () => {
  it('accepts a valid task and defaults coordinates and details to null', () => {
    const parsed = createTaskSchema.parse(validTask);
    expect(parsed.location).toEqual({
      address: '14 Harbour Rd',
      addressDetails: null,
      latitude: null,
      longitude: null,
    });
  });

  it('keeps the door-level details, trimmed', () => {
    const parsed = createTaskSchema.parse({
      ...validTask,
      location: { ...validTask.location, addressDetails: '  Flat 3B, rear gate  ' },
    });
    expect(parsed.location.addressDetails).toBe('Flat 3B, rear gate');
  });

  it('rejects details longer than the column allows', () => {
    const result = createTaskSchema.safeParse({
      ...validTask,
      location: {
        ...validTask.location,
        addressDetails: 'x'.repeat(FIELD_LIMITS.addressDetails + 1),
      },
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(formatZodError(result.error)).toContain('Details must be at most 300 characters.');
  });

  it('rejects whitespace-only required fields', () => {
    const result = createTaskSchema.safeParse({ ...validTask, title: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatZodError(result.error)).toBe('title: Title is required.');
  });

  it('requires a description (D-20)', () => {
    const { description: _omit, ...rest } = validTask;
    expect(createTaskSchema.safeParse(rest).success).toBe(false);
  });

  it('enforces the title length limit', () => {
    expect(createTaskSchema.safeParse({ ...validTask, title: 'x'.repeat(201) }).success).toBe(
      false,
    );
    expect(createTaskSchema.safeParse({ ...validTask, title: 'x'.repeat(200) }).success).toBe(true);
  });

  it('rejects a non-UUID worker id', () => {
    const result = createTaskSchema.safeParse({ ...validTask, workerId: '123' });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatZodError(result.error)).toBe('workerId: Select a worker.');
  });

  it('rejects a client-supplied status', () => {
    expect(createTaskSchema.safeParse({ ...validTask, status: 'COMPLETED' }).success).toBe(false);
  });
});

describe('locationSchema', () => {
  it('accepts both coordinates', () => {
    expect(
      locationSchema.safeParse({ address: 'A', latitude: -33.8688, longitude: 151.2093 }).success,
    ).toBe(true);
  });

  it('rejects only one coordinate', () => {
    const result = locationSchema.safeParse({ address: 'A', latitude: 10 });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(formatZodError(result.error)).toBe(
        'latitude: Latitude and longitude must be provided together.',
      );
  });

  it('rejects out-of-range coordinates', () => {
    expect(locationSchema.safeParse({ address: 'A', latitude: 91, longitude: 0 }).success).toBe(
      false,
    );
    expect(locationSchema.safeParse({ address: 'A', latitude: 0, longitude: -181 }).success).toBe(
      false,
    );
  });
});

describe('updateTaskSchema', () => {
  it('requires at least one field', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial update', () => {
    expect(updateTaskSchema.safeParse({ title: 'New title' }).success).toBe(true);
  });

  it('does not allow changing the worker or status', () => {
    expect(updateTaskSchema.safeParse({ workerId: WORKER_ID }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ status: 'CANCELLED' }).success).toBe(false);
  });
});

describe('action schemas', () => {
  it('reassign requires a worker id', () => {
    expect(reassignTaskSchema.safeParse({ workerId: WORKER_ID }).success).toBe(true);
    expect(reassignTaskSchema.safeParse({}).success).toBe(false);
  });

  it('reject requires a non-blank reason within 1000 characters', () => {
    expect(rejectTaskSchema.safeParse({ reason: 'Site locked' }).success).toBe(true);
    expect(rejectTaskSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(rejectTaskSchema.safeParse({ reason: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('note requires non-blank content', () => {
    expect(createNoteSchema.parse({ content: '  Done  ' }).content).toBe('Done');
    expect(createNoteSchema.safeParse({ content: '' }).success).toBe(false);
  });

  it('push token must be an Expo push token', () => {
    expect(
      registerPushTokenSchema.safeParse({ token: 'ExponentPushToken[abc123]', platform: 'android' })
        .success,
    ).toBe(true);
    expect(registerPushTokenSchema.safeParse({ token: 'abc', platform: 'android' }).success).toBe(
      false,
    );
    expect(
      registerPushTokenSchema.safeParse({ token: 'ExpoPushToken[abc]', platform: 'web' }).success,
    ).toBe(false);
  });
});

describe('query schemas', () => {
  it('parses a comma-separated status filter and defaults the limit', () => {
    expect(listTasksQuerySchema.parse({ status: 'ASSIGNED,IN_PROGRESS' })).toEqual({
      status: ['ASSIGNED', 'IN_PROGRESS'],
      limit: 20,
    });
  });

  it('rejects an unknown status and an out-of-range limit', () => {
    expect(listTasksQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('coerces limit from a query string', () => {
    expect(listTasksQuerySchema.parse({ limit: '5' }).limit).toBe(5);
  });

  it('users query only allows FIELD_WORKER', () => {
    expect(listUsersQuerySchema.safeParse({ role: 'FIELD_WORKER' }).success).toBe(true);
    expect(listUsersQuerySchema.safeParse({ role: 'MANAGER' }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({}).success).toBe(false);
  });
});
