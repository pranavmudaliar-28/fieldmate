import type { Note } from '@fieldmate/shared';
import { and, eq, sql } from 'drizzle-orm';
import { taskNotes } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { assertCanPerform, type Actor } from '../tasks/task.policy.js';
import type { TaskRepository } from '../tasks/task.repository.js';

const noteNotFound = () => new AppError('NOT_FOUND', 'Note was not found.');

export function createNoteService(deps: { repository: TaskRepository }) {
  const { repository } = deps;

  return {
    /** A note can only be added while the task is in progress. */
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
        updatedAt: null,
      };
    },

    /**
     * Only the author, and only while the task is in progress. The timestamp
     * is set so an edit is visible as one: notes were append-only precisely so
     * the record could not be quietly rewritten (docs/02 F-007).
     */
    async update(actor: Actor, taskId: string, noteId: string, content: string): Promise<Note> {
      const updated = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('editNote', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        const [row] = await tx
          .update(taskNotes)
          .set({ content, updatedAt: sql`now()` })
          .where(
            and(
              eq(taskNotes.id, noteId),
              eq(taskNotes.taskId, taskId),
              // Someone else's note is reported as missing, never as forbidden.
              eq(taskNotes.createdBy, actor.id),
            ),
          )
          .returning({
            id: taskNotes.id,
            createdAt: taskNotes.createdAt,
            updatedAt: taskNotes.updatedAt,
          });
        if (!row) throw noteNotFound();

        await repository.touchTask(tx, taskId);
        return row;
      });

      if (!updated) throw new AppError('TASK_NOT_FOUND', 'Task was not found.');

      return {
        id: updated.id,
        content,
        createdBy: { id: actor.id, name: actor.name },
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      };
    },

    /** Same rules as editing: the author's own, while the task is in progress. */
    async remove(actor: Actor, taskId: string, noteId: string): Promise<void> {
      const removed = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('deleteNote', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        const [row] = await tx
          .delete(taskNotes)
          .where(
            and(
              eq(taskNotes.id, noteId),
              eq(taskNotes.taskId, taskId),
              eq(taskNotes.createdBy, actor.id),
            ),
          )
          .returning({ id: taskNotes.id });
        if (!row) throw noteNotFound();

        await repository.touchTask(tx, taskId);
        return true;
      });

      if (!removed) throw new AppError('TASK_NOT_FOUND', 'Task was not found.');
    },
  };
}

export type NoteService = ReturnType<typeof createNoteService>;
