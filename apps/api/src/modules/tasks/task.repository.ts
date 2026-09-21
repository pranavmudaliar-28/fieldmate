import { WORKER_VISIBLE_STATUSES, type TaskStatus } from '@fieldmate/shared';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  taskAssignments,
  taskEvidence,
  taskLocations,
  taskNotes,
  tasks,
  users,
} from '../../db/schema.js';
import type { TaskCursor } from '../../utils/cursor.js';

export type TaskListRow = {
  id: string;
  title: string;
  status: TaskStatus;
  address: string;
  workerId: string;
  workerName: string;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type TaskDetailRows = {
  task: {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    address: string;
    latitude: number | null;
    longitude: number | null;
    workerId: string;
    workerName: string;
    assignedAt: Date;
    rejectionReason: string | null;
    rejectedAt: Date | null;
  };
  evidence: {
    id: string;
    fileKey: string;
    fileType: string;
    createdAt: Date;
    uploadedById: string;
    uploadedByName: string;
  }[];
  notes: {
    id: string;
    content: string;
    createdAt: Date;
    createdById: string;
    createdByName: string;
  }[];
};

export type ListTasksFilter = {
  statuses?: TaskStatus[];
  /** Restricts the list to tasks currently assigned to this worker. */
  workerId?: string;
  limit: number;
  cursor?: TaskCursor;
};

export type TaskWriter = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

const openAssignment = isNull(taskAssignments.endedAt);

export function createTaskRepository(db: Database) {
  /** One query: task + location + current assignment + worker (no N+1). */
  const listTasks = async (filter: ListTasksFilter): Promise<TaskListRow[]> => {
    const conditions = [openAssignment];

    if (filter.workerId) {
      conditions.push(eq(taskAssignments.workerId, filter.workerId));
      conditions.push(inArray(tasks.status, [...(filter.statuses ?? WORKER_VISIBLE_STATUSES)]));
    } else if (filter.statuses) {
      conditions.push(inArray(tasks.status, filter.statuses));
    }

    if (filter.cursor) {
      conditions.push(
        sql`(${tasks.updatedAt}, ${tasks.id}) < (${filter.cursor.updatedAt}, ${filter.cursor.id})`,
      );
    }

    return db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        address: taskLocations.address,
        workerId: users.id,
        workerName: users.name,
        rejectionReason: taskAssignments.rejectionReason,
        rejectedAt: taskAssignments.rejectedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .innerJoin(taskAssignments, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(users, eq(users.id, taskAssignments.workerId))
      .innerJoin(taskLocations, eq(taskLocations.taskId, tasks.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.updatedAt), desc(tasks.id))
      .limit(filter.limit);
  };

  const findTaskHeader = async (taskId: string) => {
    const [row] = await db
      .select({
        id: tasks.id,
        status: tasks.status,
        workerId: taskAssignments.workerId,
      })
      .from(tasks)
      .innerJoin(taskAssignments, and(eq(taskAssignments.taskId, tasks.id), openAssignment))
      .where(eq(tasks.id, taskId))
      .limit(1);
    return row;
  };

  /** Locks the task row so concurrent status changes cannot interleave. */
  const lockTask = async (tx: TaskWriter, taskId: string) => {
    const [row] = await tx
      .select({
        id: tasks.id,
        status: tasks.status,
        completedAt: tasks.completedAt,
        assignmentId: taskAssignments.id,
        workerId: taskAssignments.workerId,
      })
      .from(tasks)
      .innerJoin(taskAssignments, and(eq(taskAssignments.taskId, tasks.id), openAssignment))
      .where(eq(tasks.id, taskId))
      .limit(1)
      .for('update', { of: tasks });
    return row;
  };

  const countEvidence = async (tx: TaskWriter, taskId: string): Promise<number> => {
    const [row] = await tx
      .select({ value: count() })
      .from(taskEvidence)
      .where(eq(taskEvidence.taskId, taskId));
    return row?.value ?? 0;
  };

  const findDetail = async (taskId: string): Promise<TaskDetailRows | undefined> => {
    const [task] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
        address: taskLocations.address,
        latitude: taskLocations.latitude,
        longitude: taskLocations.longitude,
        workerId: users.id,
        workerName: users.name,
        assignedAt: taskAssignments.assignedAt,
        rejectionReason: taskAssignments.rejectionReason,
        rejectedAt: taskAssignments.rejectedAt,
      })
      .from(tasks)
      .innerJoin(taskAssignments, and(eq(taskAssignments.taskId, tasks.id), openAssignment))
      .innerJoin(users, eq(users.id, taskAssignments.workerId))
      .innerJoin(taskLocations, eq(taskLocations.taskId, tasks.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return undefined;

    const evidence = await db
      .select({
        id: taskEvidence.id,
        fileKey: taskEvidence.fileKey,
        fileType: taskEvidence.fileType,
        createdAt: taskEvidence.createdAt,
        uploadedById: users.id,
        uploadedByName: users.name,
      })
      .from(taskEvidence)
      .innerJoin(users, eq(users.id, taskEvidence.uploadedBy))
      .where(eq(taskEvidence.taskId, taskId))
      .orderBy(taskEvidence.createdAt);

    const notes = await db
      .select({
        id: taskNotes.id,
        content: taskNotes.content,
        createdAt: taskNotes.createdAt,
        createdById: users.id,
        createdByName: users.name,
      })
      .from(taskNotes)
      .innerJoin(users, eq(users.id, taskNotes.createdBy))
      .where(eq(taskNotes.taskId, taskId))
      .orderBy(taskNotes.createdAt);

    return { task, evidence, notes };
  };

  const findFieldWorker = async (workerId: string) => {
    const [worker] = await db
      .select({ id: users.id, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, workerId))
      .limit(1);
    return worker;
  };

  return {
    listTasks,
    findTaskHeader,
    findDetail,
    findFieldWorker,
    lockTask,
    countEvidence,

    async createTask(input: {
      title: string;
      description: string;
      createdBy: string;
      workerId: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
    }): Promise<string> {
      return db.transaction(async (tx) => {
        const [task] = await tx
          .insert(tasks)
          .values({
            title: input.title,
            description: input.description,
            status: 'ASSIGNED',
            createdBy: input.createdBy,
          })
          .returning({ id: tasks.id });
        if (!task) throw new Error('Failed to create task');

        await tx.insert(taskLocations).values({
          taskId: task.id,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
        });
        await tx.insert(taskAssignments).values({ taskId: task.id, workerId: input.workerId });

        return task.id;
      });
    },

    /** Runs `body` inside a transaction with the task row locked. */
    async withLockedTask<T>(
      taskId: string,
      body: (tx: TaskWriter, task: NonNullable<Awaited<ReturnType<typeof lockTask>>>) => Promise<T>,
    ): Promise<T | undefined> {
      return db.transaction(async (tx) => {
        const task = await lockTask(tx, taskId);
        if (!task) return undefined;
        return body(tx, task);
      });
    },

    async updateTaskFields(
      tx: TaskWriter,
      taskId: string,
      fields: { title?: string; description?: string },
    ): Promise<void> {
      await tx
        .update(tasks)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
    },

    async updateLocation(
      tx: TaskWriter,
      taskId: string,
      location: { address: string; latitude: number | null; longitude: number | null },
    ): Promise<void> {
      await tx.update(taskLocations).set(location).where(eq(taskLocations.taskId, taskId));
    },

    async setStatus(
      tx: TaskWriter,
      taskId: string,
      status: TaskStatus,
      completedAt: Date | null,
    ): Promise<void> {
      await tx
        .update(tasks)
        .set({ status, completedAt, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
    },

    async touchTask(tx: TaskWriter, taskId: string): Promise<void> {
      await tx.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, taskId));
    },

    async reassign(tx: TaskWriter, taskId: string, assignmentId: string, workerId: string) {
      await tx
        .update(taskAssignments)
        // The database clock sets both assigned_at and ended_at, so a slightly
        // slow API clock can never trip the "ended_at >= assigned_at" check.
        .set({ endedAt: sql`now()` })
        .where(eq(taskAssignments.id, assignmentId));
      await tx.insert(taskAssignments).values({ taskId, workerId });
    },

    async recordRejection(tx: TaskWriter, assignmentId: string, reason: string): Promise<void> {
      await tx
        .update(taskAssignments)
        .set({ rejectionReason: reason, rejectedAt: sql`now()` })
        .where(eq(taskAssignments.id, assignmentId));
    },

    /** Only active workers can take new work (docs/07 §2). */
    async listFieldWorkers() {
      return db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.role, 'FIELD_WORKER'), eq(users.isActive, true)))
        .orderBy(users.name);
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
