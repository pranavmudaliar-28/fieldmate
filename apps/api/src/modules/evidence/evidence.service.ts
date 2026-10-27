import { randomUUID } from 'node:crypto';
import type { Evidence, EvidenceSource, TaskStatus } from '@fieldmate/shared';
import { and, eq } from 'drizzle-orm';
import { taskEvidence } from '../../db/schema.js';
import { evidenceKey, type StorageService } from '../../services/storage/storage.service.js';
import type { Logger } from '../../config/logger.js';
import { AppError } from '../../utils/app-error.js';
import { detectImageType } from '../../utils/image-type.js';
import { assertCanPerform, type Actor } from '../tasks/task.policy.js';
import type { TaskRepository, TaskWriter } from '../tasks/task.repository.js';

const taskNotFound = () => new AppError('TASK_NOT_FOUND', 'Task was not found.');

const EVIDENCE_COLUMNS = {
  id: taskEvidence.id,
  fileKey: taskEvidence.fileKey,
  fileType: taskEvidence.fileType,
  source: taskEvidence.source,
  createdAt: taskEvidence.createdAt,
};

export function createEvidenceService(deps: {
  repository: TaskRepository;
  storage: StorageService;
  logger: Logger;
}) {
  const { repository, storage, logger } = deps;

  const removeOrphan = (key: string) =>
    storage
      .deleteObject(key)
      .catch((cleanupError: unknown) =>
        logger.warn({ err: cleanupError, key }, 'Failed to remove orphaned evidence object'),
      );

  /**
   * The photo this worker already uploaded to this task under `id`. An id in
   * use anywhere else is refused: the object it names belongs to someone else.
   */
  async function alreadySent(tx: TaskWriter, id: string, taskId: string, uploadedBy: string) {
    const [row] = await tx
      .select({
        ...EVIDENCE_COLUMNS,
        taskId: taskEvidence.taskId,
        uploadedBy: taskEvidence.uploadedBy,
      })
      .from(taskEvidence)
      .where(eq(taskEvidence.id, id))
      .limit(1);
    if (!row) return null;
    if (row.taskId !== taskId || row.uploadedBy !== uploadedBy) {
      throw new AppError('INVALID_REQUEST', 'That photo id is already in use.');
    }
    return row;
  }

  async function toEvidence(
    row: { id: string; fileKey: string; fileType: string; source: EvidenceSource; createdAt: Date },
    actor: Actor,
  ): Promise<Evidence> {
    return {
      id: row.id,
      url: await storage.getSignedUrl(row.fileKey),
      fileType: row.fileType as Evidence['fileType'],
      source: row.source,
      uploadedBy: { id: actor.id, name: actor.name },
      createdAt: row.createdAt.toISOString(),
    };
  }

  return {
    /**
     * Stores one photo. The object is written before the task is locked, so a
     * slow upload does not hold a database connection; the task is checked
     * again under the lock before the row goes in, so it still cannot be
     * completed or cancelled halfway through (docs/05 §7.17).
     *
     * `id` is the app's own name for the photo. A photo sent again after its
     * response was lost gets the first answer back instead of a second row.
     */
    async upload(
      actor: Actor,
      taskId: string,
      file: { buffer: Buffer; size: number } | undefined,
      source: EvidenceSource,
      id?: string,
    ): Promise<Evidence> {
      if (!file || file.size === 0) {
        throw new AppError('INVALID_FILE', 'Attach a photo to upload.');
      }

      const fileType = detectImageType(file.buffer);
      if (!fileType) {
        throw new AppError('INVALID_FILE', 'Photos must be JPEG or PNG images.');
      }

      const evidenceId = id ?? randomUUID();
      const key = evidenceKey(taskId, evidenceId, fileType);
      const permitted = (task: { status: TaskStatus; workerId: string }) =>
        assertCanPerform('addEvidence', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

      // Checked before the upload so a refused photo is never stored, and so
      // an id already taken is caught before its object could be overwritten.
      const earlier = await repository.withLockedTask(taskId, async (tx, task) => {
        const sent = id ? await alreadySent(tx, id, taskId, actor.id) : null;
        if (!sent) permitted(task);
        return sent;
      });
      if (earlier === undefined) throw taskNotFound();
      if (earlier) return toEvidence(earlier, actor);

      await storage.putObject(key, file.buffer, fileType);

      let created;
      try {
        created = await repository.withLockedTask(taskId, async (tx, task) => {
          permitted(task);
          const [row] = await tx
            .insert(taskEvidence)
            .values({
              id: evidenceId,
              taskId,
              uploadedBy: actor.id,
              fileKey: key,
              fileType,
              source,
            })
            .onConflictDoNothing({ target: taskEvidence.id })
            .returning(EVIDENCE_COLUMNS);
          // The same photo raced in twice: same id, same task, same object.
          const sent = row ?? (await alreadySent(tx, evidenceId, taskId, actor.id));
          if (!sent) throw new Error('Failed to record evidence');
          await repository.touchTask(tx, taskId);
          return sent;
        });
      } catch (error) {
        // Never leave an orphan object behind if the record cannot be written,
        // but a copy of this photo that got in first shares the object: keep it.
        const shared = id
          ? await repository
              .withLockedTask(taskId, (tx) => alreadySent(tx, id, taskId, actor.id))
              .then(Boolean, () => true)
          : false;
        if (!shared) await removeOrphan(key);
        throw error;
      }

      if (!created) {
        await removeOrphan(key);
        throw taskNotFound();
      }
      return toEvidence(created, actor);
    },

    /** Only the uploader may delete, and only while the task is in progress. */
    async remove(actor: Actor, taskId: string, evidenceId: string): Promise<void> {
      const removedKey = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('deleteEvidence', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        const [row] = await tx
          .select({
            id: taskEvidence.id,
            fileKey: taskEvidence.fileKey,
            uploadedBy: taskEvidence.uploadedBy,
          })
          .from(taskEvidence)
          .where(and(eq(taskEvidence.id, evidenceId), eq(taskEvidence.taskId, taskId)))
          .limit(1);

        if (!row) throw new AppError('EVIDENCE_NOT_FOUND', 'Photo was not found.');
        if (row.uploadedBy !== actor.id) {
          throw new AppError('FORBIDDEN', 'You can only delete photos you took.');
        }

        await tx.delete(taskEvidence).where(eq(taskEvidence.id, evidenceId));
        await repository.touchTask(tx, taskId);
        return row.fileKey;
      });

      if (!removedKey) throw taskNotFound();

      // Storage cleanup happens after commit; a failure only means an unused object.
      await storage
        .deleteObject(removedKey)
        .catch((error: unknown) =>
          logger.warn({ err: error, key: removedKey }, 'Failed to delete evidence object'),
        );
    },
  };
}

export type EvidenceService = ReturnType<typeof createEvidenceService>;
