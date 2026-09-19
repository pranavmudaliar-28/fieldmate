import type { Note } from '@fieldmate/shared';
import { taskNotes } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { assertCanPerform, type Actor } from '../tasks/task.policy.js';
import type { TaskRepository } from '../tasks/task.repository.js';

export function createNoteService(deps: { repository: TaskRepository }) {
  const { repository } = deps;

  return {
    /** Notes are append-only and can only be added while the task is in progress. */
    async create(actor: Actor, taskId: string, content: string): Promise<Note> {
      const created = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('addNote', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        const [row] = await tx
          .insert(taskNotes)
          .values({ taskId, createdBy: actor.id, content })
          .returning({ id: taskNotes.id, createdAt: taskNotes.createdAt });
        if (!row) throw new Error('Failed to create note');

        await repository.touchTask(tx, taskId);
        return row;
      });

      if (!created) throw new AppError('TASK_NOT_FOUND', 'Task was not found.');

      return {
        id: created.id,
        content,
        createdBy: { id: actor.id, name: actor.name },
        createdAt: created.createdAt.toISOString(),
      };
    },
  };
}

export type NoteService = ReturnType<typeof createNoteService>;
