import {
  createTaskSchema,
  listTasksQuerySchema,
  reassignTaskSchema,
  updateTaskSchema,
} from '@fieldmate/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
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
}): Router {
  const controller = createTaskController(
    createTaskService({ repository: createTaskRepository(deps.db), storage: deps.storage }),
  );

  const router = Router();
  const withTaskId = validate(taskParamsSchema, 'params');

  router.use(authenticate(deps));

  router.get('/', validate(listTasksQuerySchema, 'query'), controller.list);
  router.post('/', requireRole('MANAGER'), validate(createTaskSchema), controller.create);
  router.get('/:taskId', withTaskId, controller.get);
  router.patch(
    '/:taskId',
    requireRole('MANAGER'),
    withTaskId,
    validate(updateTaskSchema),
    controller.update,
  );
  router.post(
    '/:taskId/assignment',
    requireRole('MANAGER'),
    withTaskId,
    validate(reassignTaskSchema),
    controller.assign,
  );
  router.post('/:taskId/cancel', requireRole('MANAGER'), withTaskId, controller.cancel);
  router.post('/:taskId/reopen', requireRole('MANAGER'), withTaskId, controller.reopen);
  router.post('/:taskId/complete', withTaskId, controller.complete);
  // Worker-only routes (start, reject, evidence, notes) are added in 6E.

  return router;
}
