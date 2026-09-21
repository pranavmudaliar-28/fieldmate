import {
  TASK_MANAGING_ROLES,
  createTaskSchema,
  listTasksQuerySchema,
  reassignTaskSchema,
  rejectTaskSchema,
  updateTaskSchema,
} from '@fieldmate/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { Database } from '../../db/client.js';
import type { PushService } from '../../services/push/push.service.js';
import { createEvidenceRouter } from '../evidence/evidence.routes.js';
import { createNoteRouter } from '../notes/note.routes.js';
import { createDeviceTokenRepository } from '../users/device-token.repository.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate } from '../../middleware/validate.js';
import type { StorageService } from '../../services/storage/storage.service.js';
import { createTaskController } from './task.controller.js';
import { createTaskRepository } from './task.repository.js';
import { createTaskService } from './task.service.js';

const taskParamsSchema = z.strictObject({ taskId: z.uuid('Task was not found.') });

export function createTaskRouter(deps: {
  db: Database;
  config: AppConfig;
  storage: StorageService;
  logger: Logger;
  push: PushService;
}): Router {
  const repository = createTaskRepository(deps.db);
  const controller = createTaskController(
    createTaskService({
      repository,
      storage: deps.storage,
      push: deps.push,
      tokens: createDeviceTokenRepository(deps.db),
      logger: deps.logger,
    }),
  );

  const router = Router();
  const withTaskId = validate(taskParamsSchema, 'params');

  router.use(authenticate(deps));

  router.get('/', validate(listTasksQuerySchema, 'query'), controller.list);
  router.post(
    '/',
    requireRole(...TASK_MANAGING_ROLES),
    validate(createTaskSchema),
    controller.create,
  );
  router.get('/:taskId', withTaskId, controller.get);
  router.patch(
    '/:taskId',
    requireRole(...TASK_MANAGING_ROLES),
    withTaskId,
    validate(updateTaskSchema),
    controller.update,
  );
  router.post(
    '/:taskId/assignment',
    requireRole(...TASK_MANAGING_ROLES),
    withTaskId,
    validate(reassignTaskSchema),
    controller.assign,
  );
  router.post(
    '/:taskId/cancel',
    requireRole(...TASK_MANAGING_ROLES),
    withTaskId,
    controller.cancel,
  );
  router.post(
    '/:taskId/reopen',
    requireRole(...TASK_MANAGING_ROLES),
    withTaskId,
    controller.reopen,
  );
  router.post('/:taskId/complete', withTaskId, controller.complete);

  // The worker's lifecycle, one endpoint per step. A task only becomes
  // IN_PROGRESS through /start, which needs the worker to have arrived first.
  const workerStep = (path: string, handler: RequestHandler) =>
    router.post(path, requireRole('FIELD_WORKER'), withTaskId, handler);

  workerStep('/:taskId/accept', controller.accept);
  workerStep('/:taskId/depart', controller.depart);
  workerStep('/:taskId/arrive', controller.arrive);
  workerStep('/:taskId/start', controller.start);
  workerStep('/:taskId/step-back', controller.stepBack);
  router.post(
    '/:taskId/reject',
    requireRole('FIELD_WORKER'),
    withTaskId,
    validate(rejectTaskSchema),
    controller.reject,
  );

  router.use(
    '/:taskId/evidence',
    withTaskId,
    createEvidenceRouter({ repository, storage: deps.storage, logger: deps.logger }),
  );
  router.use('/:taskId/notes', withTaskId, createNoteRouter({ repository }));

  return router;
}
