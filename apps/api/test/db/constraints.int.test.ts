import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import {
  devicePushTokens,
  taskAssignments,
  taskEvidence,
  taskLocations,
  taskNotes,
  tasks,
  users,
} from '../../src/db/schema.js';
import {
  closeTestDb,
  dbErrorMessage,
  insertManager,
  insertTask,
  insertUser,
  testDb,
  truncateAll,
  uniqueEmail,
} from '../helpers/db.js';

const db = testDb();

beforeEach(truncateAll);
afterAll(closeTestDb);

describe('users constraints', () => {
  it('rejects a duplicate email', async () => {
    const email = uniqueEmail();
    await insertUser({ email });
    await expect(dbErrorMessage(insertUser({ email }))).resolves.toMatch(/duplicate key|unique/i);
  });

  it('rejects an email that is not lowercase', async () => {
    await expect(dbErrorMessage(insertUser({ email: 'Manager@FieldMate.test' }))).resolves.toMatch(
      /users_email_lowercase/,
    );
  });

  it('rejects a blank name', async () => {
    await expect(dbErrorMessage(insertUser({ name: '   ' }))).resolves.toMatch(
      /users_name_not_blank/,
    );
  });

  it('rejects a negative token_version', async () => {
    await expect(dbErrorMessage(insertUser({ tokenVersion: -1 }))).resolves.toMatch(
      /users_token_version_non_negative/,
    );
  });

  it('defaults token_version to 0', async () => {
    const user = await insertUser();
    expect(user.tokenVersion).toBe(0);
  });
});

describe('tasks constraints', () => {
  it('rejects COMPLETED without completed_at', async () => {
    const manager = await insertManager();
    await expect(
      dbErrorMessage(
        db.insert(tasks).values({
          title: 'T',
          description: 'D',
          status: 'COMPLETED',
          createdBy: manager.id,
        }),
      ),
    ).resolves.toMatch(/tasks_completed_at_matches_status/);
  });

  it('rejects a non-COMPLETED status with completed_at set', async () => {
    const manager = await insertManager();
    await expect(
      dbErrorMessage(
        db.insert(tasks).values({
          title: 'T',
          description: 'D',
          status: 'ASSIGNED',
          completedAt: new Date(),
          createdBy: manager.id,
        }),
      ),
    ).resolves.toMatch(/tasks_completed_at_matches_status/);
  });

  it('accepts COMPLETED with completed_at', async () => {
    const manager = await insertManager();
    const [row] = await db
      .insert(tasks)
      .values({
        title: 'T',
        description: 'D',
        status: 'COMPLETED',
        completedAt: new Date(),
        createdBy: manager.id,
      })
      .returning();
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it('rejects blank title and description', async () => {
    const manager = await insertManager();
    await expect(
      dbErrorMessage(
        db.insert(tasks).values({ title: '  ', description: 'D', createdBy: manager.id }),
      ),
    ).resolves.toMatch(/tasks_title_not_blank/);
    await expect(
      dbErrorMessage(
        db.insert(tasks).values({ title: 'T', description: ' ', createdBy: manager.id }),
      ),
    ).resolves.toMatch(/tasks_description_not_blank/);
  });

  it('rejects created_by pointing at a missing user', async () => {
    await expect(
      dbErrorMessage(
        db.insert(tasks).values({
          title: 'T',
          description: 'D',
          createdBy: '00000000-0000-4000-8000-000000000000',
        }),
      ),
    ).resolves.toMatch(/foreign key/i);
  });

  it('defaults status to ASSIGNED', async () => {
    const { task } = await insertTask();
    expect(task.status).toBe('ASSIGNED');
    expect(task.completedAt).toBeNull();
  });
});

describe('task_assignments constraints', () => {
  it('allows only one open assignment per task', async () => {
    const { task } = await insertTask();
    const other = await insertUser();
    await expect(
      dbErrorMessage(db.insert(taskAssignments).values({ taskId: task.id, workerId: other.id })),
    ).resolves.toMatch(/task_assignments_one_open_uq/);
  });

  it('allows a new assignment once the previous one has ended (reassignment)', async () => {
    const { task, assignment } = await insertTask();
    const other = await insertUser();
    await db
      .update(taskAssignments)
      .set({ endedAt: new Date() })
      .where(eq(taskAssignments.id, assignment.id));

    const [next] = await db
      .insert(taskAssignments)
      .values({ taskId: task.id, workerId: other.id })
      .returning();
    expect(next?.endedAt).toBeNull();

    const all = await db.select().from(taskAssignments).where(eq(taskAssignments.taskId, task.id));
    expect(all).toHaveLength(2);
    expect(all.filter((a) => a.endedAt === null)).toHaveLength(1);
  });

  it('rejects a rejection reason without a rejected_at (and the reverse)', async () => {
    const { assignment } = await insertTask();
    await expect(
      dbErrorMessage(
        db
          .update(taskAssignments)
          .set({ rejectionReason: 'Site locked' })
          .where(eq(taskAssignments.id, assignment.id)),
      ),
    ).resolves.toMatch(/task_assignments_rejection_pair/);
    await expect(
      dbErrorMessage(
        db
          .update(taskAssignments)
          .set({ rejectedAt: new Date() })
          .where(eq(taskAssignments.id, assignment.id)),
      ),
    ).resolves.toMatch(/task_assignments_rejection_pair/);
  });

  it('accepts a rejection with both fields', async () => {
    const { assignment } = await insertTask();
    const [row] = await db
      .update(taskAssignments)
      .set({ rejectionReason: 'Site locked', rejectedAt: new Date() })
      .where(eq(taskAssignments.id, assignment.id))
      .returning();
    expect(row?.rejectionReason).toBe('Site locked');
  });

  it('rejects ended_at before assigned_at', async () => {
    const { assignment } = await insertTask();
    await expect(
      dbErrorMessage(
        db
          .update(taskAssignments)
          .set({ endedAt: new Date(assignment.assignedAt.getTime() - 1000) })
          .where(eq(taskAssignments.id, assignment.id)),
      ),
    ).resolves.toMatch(/task_assignments_ended_after_assigned/);
  });
});

describe('task_locations constraints', () => {
  it('allows only one location per task', async () => {
    const { task } = await insertTask();
    await expect(
      dbErrorMessage(db.insert(taskLocations).values({ taskId: task.id, address: 'Second' })),
    ).resolves.toMatch(/duplicate key|unique/i);
  });

  it('rejects one coordinate without the other', async () => {
    const { task } = await insertTask();
    await expect(
      dbErrorMessage(
        db.update(taskLocations).set({ latitude: 10 }).where(eq(taskLocations.taskId, task.id)),
      ),
    ).resolves.toMatch(/task_locations_coords_pair/);
  });

  it('rejects out-of-range coordinates', async () => {
    const { task } = await insertTask();
    await expect(
      dbErrorMessage(
        db
          .update(taskLocations)
          .set({ latitude: 91, longitude: 0 })
          .where(eq(taskLocations.taskId, task.id)),
      ),
    ).resolves.toMatch(/task_locations_lat_range/);
    await expect(
      dbErrorMessage(
        db
          .update(taskLocations)
          .set({ latitude: 0, longitude: -181 })
          .where(eq(taskLocations.taskId, task.id)),
      ),
    ).resolves.toMatch(/task_locations_lng_range/);
  });

  it('rejects a blank address', async () => {
    const { task } = await insertTask();
    await expect(
      dbErrorMessage(
        db.update(taskLocations).set({ address: '   ' }).where(eq(taskLocations.taskId, task.id)),
      ),
    ).resolves.toMatch(/task_locations_address_not_blank/);
  });

  it('stores coordinates as numbers with 6 decimal places', async () => {
    const { task } = await insertTask();
    const [row] = await db
      .update(taskLocations)
      .set({ latitude: -33.8688, longitude: 151.2093 })
      .where(eq(taskLocations.taskId, task.id))
      .returning();
    expect(row?.latitude).toBeCloseTo(-33.8688, 6);
    expect(row?.longitude).toBeCloseTo(151.2093, 6);
    expect(typeof row?.latitude).toBe('number');
  });
});

describe('task_evidence and task_notes constraints', () => {
  it('rejects a file type that is not JPEG or PNG', async () => {
    const { task, workerId } = await insertTask();
    await expect(
      dbErrorMessage(
        db.insert(taskEvidence).values({
          taskId: task.id,
          uploadedBy: workerId,
          fileKey: `tasks/${task.id}/evidence/a.gif`,
          fileType: 'image/gif',
        }),
      ),
    ).resolves.toMatch(/task_evidence_file_type/);
  });

  it('rejects a duplicate file key', async () => {
    const { task, workerId } = await insertTask();
    const fileKey = `tasks/${task.id}/evidence/a.jpg`;
    await db
      .insert(taskEvidence)
      .values({ taskId: task.id, uploadedBy: workerId, fileKey, fileType: 'image/jpeg' });
    await expect(
      dbErrorMessage(
        db
          .insert(taskEvidence)
          .values({ taskId: task.id, uploadedBy: workerId, fileKey, fileType: 'image/jpeg' }),
      ),
    ).resolves.toMatch(/duplicate key|unique/i);
  });

  it('rejects blank note content', async () => {
    const { task, workerId } = await insertTask();
    await expect(
      dbErrorMessage(
        db.insert(taskNotes).values({ taskId: task.id, createdBy: workerId, content: '  ' }),
      ),
    ).resolves.toMatch(/task_notes_content_not_blank/);
  });
});

describe('device_push_tokens constraints', () => {
  it('rejects a duplicate token and an unknown platform', async () => {
    const user = await insertUser();
    const token = 'ExponentPushToken[abc123]';
    await db.insert(devicePushTokens).values({ userId: user.id, token, platform: 'android' });
    await expect(
      dbErrorMessage(
        db.insert(devicePushTokens).values({ userId: user.id, token, platform: 'ios' }),
      ),
    ).resolves.toMatch(/duplicate key|unique/i);
    await expect(
      dbErrorMessage(
        db
          .insert(devicePushTokens)
          .values({ userId: user.id, token: 'ExponentPushToken[other]', platform: 'web' }),
      ),
    ).resolves.toMatch(/device_push_tokens_platform/);
  });

  it('deletes a user tokens when the user is deleted (CASCADE)', async () => {
    const user = await insertUser();
    await db
      .insert(devicePushTokens)
      .values({ userId: user.id, token: 'ExponentPushToken[cascade]', platform: 'ios' });

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db
      .select()
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, user.id));
    expect(remaining).toHaveLength(0);
  });
});

describe('referential integrity', () => {
  it('refuses to delete a user who created tasks (RESTRICT)', async () => {
    const { managerId } = await insertTask();
    await expect(dbErrorMessage(db.delete(users).where(eq(users.id, managerId)))).resolves.toMatch(
      /foreign key/i,
    );
  });

  it('refuses to delete a task that has an assignment (RESTRICT)', async () => {
    const { task } = await insertTask();
    await expect(dbErrorMessage(db.delete(tasks).where(eq(tasks.id, task.id)))).resolves.toMatch(
      /foreign key/i,
    );
  });
});

describe('full task graph', () => {
  it('stores a task with location, assignment, evidence and notes', async () => {
    const { task, workerId } = await insertTask();
    await db
      .update(taskLocations)
      .set({ latitude: -33.8688, longitude: 151.2093 })
      .where(eq(taskLocations.taskId, task.id));
    await db.insert(taskEvidence).values({
      taskId: task.id,
      uploadedBy: workerId,
      fileKey: `tasks/${task.id}/evidence/1.jpg`,
      fileType: 'image/jpeg',
    });
    await db
      .insert(taskNotes)
      .values({ taskId: task.id, createdBy: workerId, content: 'Replaced valve.' });

    const stored = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    const [location] = await db
      .select()
      .from(taskLocations)
      .where(eq(taskLocations.taskId, task.id));
    const evidence = await db.select().from(taskEvidence).where(eq(taskEvidence.taskId, task.id));
    const notes = await db.select().from(taskNotes).where(eq(taskNotes.taskId, task.id));
    const assignments = await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, task.id));

    expect(stored?.title).toBe('Replace water meter');
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(location?.address).toBe('14 Harbour Rd');
    expect(evidence).toHaveLength(1);
    expect(notes).toHaveLength(1);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.endedAt).toBeNull();
  });
});
