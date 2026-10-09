import {
  evidenceSourceSchema,
  type EvidenceSource,
  type EvidenceSourceInput,
} from '@fieldmate/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Logger } from '../../config/logger.js';
import { requireRole } from '../../middleware/require-role.js';
import { uploadErrorHandler, uploadPhoto } from '../../middleware/upload.js';
import { validate, validated } from '../../middleware/validate.js';
import type { StorageService } from '../../services/storage/storage.service.js';
import { actor, taskIdOf } from '../tasks/task.controller.js';
import type { TaskRepository } from '../tasks/task.repository.js';
import { createEvidenceService } from './evidence.service.js';

const evidenceParamsSchema = z.strictObject({
  taskId: z.uuid('Task was not found.'),
  evidenceId: z.uuid('Photo was not found.'),
});

/** Mounted under /tasks/:taskId/evidence (docs/05 §7.17–7.18). */
export function createEvidenceRouter(deps: {
  repository: TaskRepository;
  storage: StorageService;
  logger: Logger;
}): Router {
  const service = createEvidenceService(deps);

  const upload: RequestHandler = async (req, res) => {
    // Multipart, so the field arrives as a string alongside the file.
    const { source } = validated<EvidenceSourceInput>(req);
    const evidence = await service.upload(
      actor(req),
      taskIdOf(req),
      req.file,
      source as EvidenceSource,
    );
    res.status(201).json(evidence);
  };

  const remove: RequestHandler = async (req, res) => {
    const { taskId, evidenceId } = validated<{ taskId: string; evidenceId: string }>(req, 'params');
    await service.remove(actor(req), taskId, evidenceId);
    res.status(204).end();
  };

  const router = Router({ mergeParams: true });
  // Validation runs after multer, which is what parses the text fields.
  router.post(
    '/',
    requireRole('FIELD_WORKER'),
    uploadPhoto,
    uploadErrorHandler,
    validate(evidenceSourceSchema),
    upload,
  );
  router.delete(
    '/:evidenceId',
    requireRole('FIELD_WORKER'),
    validate(evidenceParamsSchema, 'params'),
    remove,
  );
  return router;
}
