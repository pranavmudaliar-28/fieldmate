import { randomUUID } from 'node:crypto';
import type { Evidence } from '@fieldmate/shared';
import { and, eq } from 'drizzle-orm';
import { taskEvidence } from '../../db/schema.js';
import { evidenceKey, type StorageService } from '../../services/storage/storage.service.js';
import type { Logger } from '../../config/logger.js';
import { AppError } from '../../utils/app-error.js';
import { detectImageType } from '../../utils/image-type.js';
import { assertCanPerform, type Actor } from '../tasks/task.policy.js';
import type { TaskRepository } from '../tasks/task.repository.js';

const taskNotFound = () => new AppError('TASK_NOT_FOUND', 'Task was not found.');

export function createEvidenceService(deps: {
  repository: TaskRepository;
  storage: StorageService;
  logger: Logger;
}) {
  const { repository, storage, logger } = deps;

  return {
    /**
     * Stores one photo. The task row stays locked while the object is written,
     * so the task cannot be completed or cancelled halfway through (docs/05 §7.17).
     */
    async upload(
      actor: Actor,
      taskId: string,
      file: { buffer: Buffer; size: number } | undefined,
    ): Promise<Evidence> {
      if (!file || file.size === 0) {
        throw new AppError('INVALID_FILE', 'Attach a photo to upload.');
      }

      const fileType = detectImageType(file.buffer);
      if (!fileType) {
        throw new AppError('INVALID_FILE', 'Photos must be JPEG or PNG images.');
      }

      const evidenceId = randomUUID();
      const key = evidenceKey(taskId, evidenceId, fileType);

      const created = await repository.withLockedTask(taskId, async (tx, task) => {
        assertCanPerform('addEvidence', actor, {
          status: task.status,
          currentWorkerId: task.workerId,
        });

        await storage.putObject(key, file.buffer, fileType);

        try {
          const [row] = await tx
            .insert(taskEvidence)
            .values({
              id: evidenceId,
              taskId,
              uploadedBy: actor.id,
              fileKey: key,
              fileType,
            })
            .returning({ id: taskEvidence.id, createdAt: taskEvidence.createdAt });
          if (!row) throw new Error('Failed to record evidence');
          await repository.touchTask(tx, taskId);
          return row;
        } catch (error) {
          // Never leave an orphan object behind if the record cannot be written.
          await storage
            .deleteObject(key)
            .catch((cleanupError: unknown) =>
              logger.warn({ err: cleanupError, key }, 'Failed to remove orphaned evidence object'),
            );
          throw error;
        }
      });

      if (!created) throw taskNotFound();

      return {
        id: created.id,
        url: await storage.getSignedUrl(key),
        fileType,
        uploadedBy: { id: actor.id, name: actor.name },
        createdAt: created.createdAt.toISOString(),
      };
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
