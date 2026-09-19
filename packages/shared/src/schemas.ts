import { z } from 'zod';
import { FIELD_LIMITS, PAGINATION, PUSH_PLATFORMS, TASK_STATUSES } from './constants.js';

const requiredText = (max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const loginSchema = z.strictObject({
  email: z
    .string({ error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required.')
    .max(FIELD_LIMITS.email, 'Enter a valid email address.')
    .pipe(z.email('Enter a valid email address.')),
  password: z
    .string({ error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(
      FIELD_LIMITS.passwordMax,
      `Password must be at most ${FIELD_LIMITS.passwordMax} characters.`,
    ),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const locationSchema = z
  .strictObject({
    address: requiredText(FIELD_LIMITS.address, 'Address'),
    latitude: z
      .number('Latitude must be a number.')
      .min(-90, 'Latitude must be between -90 and 90.')
      .max(90, 'Latitude must be between -90 and 90.')
      .nullable()
      .default(null),
    longitude: z
      .number('Longitude must be a number.')
      .min(-180, 'Longitude must be between -180 and 180.')
      .max(180, 'Longitude must be between -180 and 180.')
      .nullable()
      .default(null),
  })
  .refine((l) => (l.latitude === null) === (l.longitude === null), {
    message: 'Latitude and longitude must be provided together.',
    path: ['latitude'],
  });
export type LocationInput = z.input<typeof locationSchema>;

const workerId = z.uuid('Select a worker.');

export const createTaskSchema = z.strictObject({
  title: requiredText(FIELD_LIMITS.taskTitle, 'Title'),
  description: requiredText(FIELD_LIMITS.taskDescription, 'Description'),
  workerId,
  location: locationSchema,
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = z
  .strictObject({
    title: requiredText(FIELD_LIMITS.taskTitle, 'Title').optional(),
    description: requiredText(FIELD_LIMITS.taskDescription, 'Description').optional(),
    /** Replaces the whole location. */
    location: locationSchema.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const reassignTaskSchema = z.strictObject({ workerId });
export type ReassignTaskInput = z.input<typeof reassignTaskSchema>;

export const rejectTaskSchema = z.strictObject({
  reason: requiredText(FIELD_LIMITS.rejectionReason, 'Reason'),
});
export type RejectTaskInput = z.input<typeof rejectTaskSchema>;

export const createNoteSchema = z.strictObject({
  content: requiredText(FIELD_LIMITS.note, 'Note'),
});
export type CreateNoteInput = z.input<typeof createNoteSchema>;

export const registerPushTokenSchema = z.strictObject({
  token: z
    .string({ error: 'Push token is required.' })
    .max(FIELD_LIMITS.pushToken, 'Invalid push token.')
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Invalid push token.'),
  platform: z.enum(PUSH_PLATFORMS, 'Platform must be ios or android.'),
});
export type RegisterPushTokenInput = z.input<typeof registerPushTokenSchema>;

export const listTasksQuerySchema = z.strictObject({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((v) => v.trim()) : undefined))
    .pipe(z.array(z.enum(TASK_STATUSES, 'Invalid status filter.')).min(1).optional()),
  limit: z.coerce
    .number('Limit must be a number.')
    .int('Limit must be a whole number.')
    .min(1, `Limit must be between 1 and ${PAGINATION.maxLimit}.`)
    .max(PAGINATION.maxLimit, `Limit must be between 1 and ${PAGINATION.maxLimit}.`)
    .default(PAGINATION.defaultLimit),
  cursor: z.string().max(200).optional(),
});
export type ListTasksQuery = z.output<typeof listTasksQuerySchema>;

export const listUsersQuerySchema = z.strictObject({
  role: z.literal('FIELD_WORKER', 'Role must be FIELD_WORKER.'),
});

export const uuidParamSchema = z.uuid();

/** First issue formatted as "field: message" (or just "message" at the root). */
export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request.';
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
