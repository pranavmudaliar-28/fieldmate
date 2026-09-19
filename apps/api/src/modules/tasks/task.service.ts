import {
  WORKER_VISIBLE_STATUSES,
  hasRequiredEvidence,
  type CreateTaskInput,
  type ListTasksQuery,
  type Paginated,
  type TaskDetail,
  type TaskListItem,
  type UpdateTaskInput,
  type UserSummary,
} from '@fieldmate/shared';
import type { StorageService } from '../../services/storage/storage.service.js';
import { AppError } from '../../utils/app-error.js';
import { encodeCursor, type TaskCursor } from '../../utils/cursor.js';
import { toTaskDetail, toTaskListItem } from './task.mapper.js';
import { assertCanPerform, assertCanViewTask, type Actor } from './task.policy.js';
import type { TaskRepository } from './task.repository.js';

const taskNotFound = () => new AppError('TASK_NOT_FOUND', 'Task was not found.');

export function createTaskService(deps: { repository: TaskRepository; storage: StorageService }) {
  const { repository, storage } = deps;

  /** Loads the task fresh so responses always reflect the committed state. */
  async function detail(taskId: string): Promise<TaskDetail> {
    const rows = await repository.findDetail(taskId);
    if (!rows) throw taskNotFound();
    return toTaskDetail(rows, storage);
  }

  async function assertFieldWorker(workerId: string): Promise<void> {
    const worker = await repository.findFieldWorker(workerId);
    if (!worker || worker.role !== 'FIELD_WORKER') {
      throw new AppError('INVALID_WORKER', 'Select a field worker to assign this task to.');
    }
  }

  /** Loads the task for an action, then applies visibility, role and status rules. */
  async function loadForView(actor: Actor, taskId: string) {
    const header = await repository.findTaskHeader(taskId);
    if (!header) throw taskNotFound();
    assertCanViewTask(actor, { status: header.status, currentWorkerId: header.workerId });
    return header;
  }

  return {
    async list(
      actor: Actor,
      query: ListTasksQuery,
      cursor?: TaskCursor,
    ): Promise<Paginated<TaskListItem>> {
      // A worker's scope is decided by the server: a status filter can only
      // narrow their visible statuses, never widen them (docs/05 §7.7).
      const statuses =
        actor.role === 'FIELD_WORKER'
          ? (query.status ?? [...WORKER_VISIBLE_STATUSES]).filter((status) =>
              WORKER_VISIBLE_STATUSES.includes(status as (typeof WORKER_VISIBLE_STATUSES)[number]),
            )
          : query.status;

      if (actor.role === 'FIELD_WORKER' && statuses && statuses.length === 0) {
        return { items: [], nextCursor: null };
      }

      const rows = await repository.listTasks({
        ...(statuses ? { statuses } : {}),
        ...(actor.role === 'FIELD_WORKER' ? { workerId: actor.id } : {}),
        limit: query.limit + 1,
        ...(cursor ? { cursor } : {}),
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);

      return {
        items: page.map((row) => toTaskListItem(row, actor.role)),
        nextCursor:
          hasMore && last ? encodeCursor({ updatedAt: last.updatedAt, id: last.id }) : null,
      };
    },

    async get(actor: Actor, taskId: string): Promise<TaskDetail> {
      await loadForView(actor, taskId);
      return detail(taskId);
    },

    async listFieldWorkers(): Promise<UserSummary[]> {
      return repository.listFieldWorkers();
    },

    async create(actor: Actor, input: CreateTaskInput): Promise<TaskDetail> {
      const location = input.location;
      await assertFieldWorker(input.workerId);

      const taskId = await repository.createTask({
        title: input.title,
        description: input.description,
        createdBy: actor.id,
        workerId: input.workerId,
        address: location.address,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
      });

      return detail(taskId);
    },

    /** Title, description and location only; status changes have their own actions. */
    async update(actor: Actor, taskId: string, input: UpdateTaskInput): Promise<TaskDetail> {
      const changed = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('edit', actor, { status: task.status, currentWorkerId: task.workerId });

        const current = await repository.findDetail(taskId);
        if (!current) throw taskNotFound();

        const fields: { title?: string; description?: string } = {};
        if (input.title !== undefined && input.title !== current.task.title) {
          fields.title = input.title;
        }
        if (input.description !== undefined && input.description !== current.task.description) {
          fields.description = input.description;
        }

        const newLocation = input.location;
        const locationChanged =
          newLocation !== undefined &&
          (newLocation.address !== current.task.address ||
            (newLocation.latitude ?? null) !== current.task.latitude ||
            (newLocation.longitude ?? null) !== current.task.longitude);

        if (Object.keys(fields).length === 0 && !locationChanged) return false;

        if (Object.keys(fields).length > 0) {
          await repository.updateTaskFields(tx, taskId, fields);
        } else {
          await repository.touchTask(tx, taskId);
        }

        if (locationChanged && newLocation) {
          await repository.updateLocation(tx, taskId, {
            address: newLocation.address,
            latitude: newLocation.latitude ?? null,
            longitude: newLocation.longitude ?? null,
          });
        }

        return true;
      });

      if (changed === undefined) throw taskNotFound();
      return detail(taskId);
    },

    async reassign(actor: Actor, taskId: string, workerId: string): Promise<TaskDetail> {
      await assertFieldWorker(workerId);

      const result = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('reassign', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        // Re-picking the same worker only makes sense after a rejection.
        if (task.status !== 'REJECTED' && task.workerId === workerId) {
          throw new AppError('SAME_WORKER', 'This task is already assigned to that worker.');
        }

        await repository.reassign(tx, taskId, task.assignmentId, workerId);
        await repository.setStatus(tx, taskId, 'ASSIGNED', null);
        return true;
      });

      if (result === undefined) throw taskNotFound();
      return detail(taskId);
    },

    async cancel(actor: Actor, taskId: string): Promise<TaskDetail> {
      const result = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('cancel', actor, { status: task.status, currentWorkerId: task.workerId });
        await repository.setStatus(tx, taskId, 'CANCELLED', null);
        return true;
      });

      if (result === undefined) throw taskNotFound();
      return detail(taskId);
    },

    async reopen(actor: Actor, taskId: string): Promise<TaskDetail> {
      const result = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('reopen', actor, { status: task.status, currentWorkerId: task.workerId });
        await repository.setStatus(tx, taskId, 'ASSIGNED', null);
        return true;
      });

      if (result === undefined) throw taskNotFound();
      return detail(taskId);
    },

    /**
     * Completion needs at least one photo. The count is read under the same row
     * lock as the status change, so a concurrent photo delete cannot slip past it.
     */
    async complete(actor: Actor, taskId: string): Promise<TaskDetail> {
      const result = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('complete', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        const evidenceCount = await repository.countEvidence(tx, taskId);
        if (!hasRequiredEvidence(evidenceCount)) {
          throw new AppError(
            'EVIDENCE_REQUIRED',
            'At least 1 photo is required to complete this task.',
          );
        }

        await repository.setStatus(tx, taskId, 'COMPLETED', new Date());
        return true;
      });

      if (result === undefined) throw taskNotFound();
      return detail(taskId);
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
