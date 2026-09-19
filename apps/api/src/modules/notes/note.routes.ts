import { createNoteSchema, type CreateNoteInput } from '@fieldmate/shared';
import { Router, type RequestHandler } from 'express';
import { requireRole } from '../../middleware/require-role.js';
import { validate, validated } from '../../middleware/validate.js';
import { actor, taskIdOf } from '../tasks/task.controller.js';
import type { TaskRepository } from '../tasks/task.repository.js';
import { createNoteService } from './note.service.js';

/** Mounted under /tasks/:taskId/notes (docs/05 §7.19). */
export function createNoteRouter(deps: { repository: TaskRepository }): Router {
  const service = createNoteService(deps);

  const create: RequestHandler = async (req, res) => {
    const { content } = validated<CreateNoteInput>(req);
    const note = await service.create(actor(req), taskIdOf(req), content);
    res.status(201).json(note);
  };

  const router = Router({ mergeParams: true });
  router.post('/', requireRole('FIELD_WORKER'), validate(createNoteSchema), create);
  return router;
}
