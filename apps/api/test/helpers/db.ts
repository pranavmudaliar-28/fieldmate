import { randomUUID } from 'node:crypto';
import type { TaskStatus } from '@fieldmate/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb, type Database, type DbHandle } from '../../src/db/client.js';
import {
  taskAssignments,
  taskLocations,
  tasks,
  users,
  type NewTaskRow,
  type NewUserRow,
} from '../../src/db/schema.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://fieldmate:fieldmate@localhost:5432/fieldmate_test';

let handle: DbHandle | undefined;

export function testDb(): Database {
  handle ??= createDb(TEST_DATABASE_URL, { max: 2 });
  return handle.db;
}

export async function closeTestDb(): Promise<void> {
  await handle?.close();
  handle = undefined;
}

const TABLES = [
  'task_evidence',
  'task_notes',
  'task_assignments',
  'task_locations',
  'device_push_tokens',
  'tasks',
  'users',
] as const;

export async function truncateAll(): Promise<void> {
  const db = testDb();
  await db.execute(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

/**
 * Runs a query that must fail and returns the whole error chain as text.
 * Drizzle wraps driver errors in "Failed query: ...", so the constraint name
 * that Postgres reports lives in `error.cause`.
 */
export async function dbErrorMessage(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    const messages: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    }
    return messages.join(' | ');
  }
  throw new Error('Expected the query to be rejected, but it succeeded.');
}

/**
 * Sets a task status directly, for states the API cannot reach yet
 * (worker actions arrive in 6E). Keeps the completed_at rule satisfied.
 */
export async function forceStatus(taskId: string, status: TaskStatus): Promise<void> {
  await testDb()
    .update(tasks)
    .set({
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

/** Records a rejection on the task's current assignment (worker route arrives in 6E). */
export async function recordRejection(taskId: string, reason: string): Promise<void> {
  const db = testDb();
  await db
    .update(taskAssignments)
    .set({ rejectionReason: reason, rejectedAt: new Date() })
    .where(and(eq(taskAssignments.taskId, taskId), isNull(taskAssignments.endedAt)));
  await forceStatus(taskId, 'REJECTED');
}

/** Unique email per call so tests never collide on the UNIQUE constraint. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID()}@fieldmate.test`;
}

export async function insertUser(overrides: Partial<NewUserRow> = {}) {
  const [row] = await testDb()
    .insert(users)
    .values({
      name: 'Test User',
      email: uniqueEmail(),
      passwordHash: 'not-a-real-hash',
      role: 'FIELD_WORKER',
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('Failed to insert user');
  return row;
}

export async function insertManager(overrides: Partial<NewUserRow> = {}) {
  return insertUser({ name: 'Test Manager', role: 'MANAGER', ...overrides });
}

/** Inserts a task with its location and one open assignment (the normal created state). */
export async function insertTask(
  options: { createdBy?: string; workerId?: string; task?: Partial<NewTaskRow> } = {},
) {
  const db = testDb();
  const manager = options.createdBy ? { id: options.createdBy } : await insertManager();
  const worker = options.workerId ? { id: options.workerId } : await insertUser();

  const [task] = await db
    .insert(tasks)
    .values({
      title: 'Replace water meter',
      description: 'Old meter leaking.',
      createdBy: manager.id,
      ...options.task,
    })
    .returning();
  if (!task) throw new Error('Failed to insert task');

  await db.insert(taskLocations).values({ taskId: task.id, address: '14 Harbour Rd' });
  const [assignment] = await db
    .insert(taskAssignments)
    .values({ taskId: task.id, workerId: worker.id })
    .returning();
  if (!assignment) throw new Error('Failed to insert assignment');

  return { task, assignment, managerId: manager.id, workerId: worker.id };
}
