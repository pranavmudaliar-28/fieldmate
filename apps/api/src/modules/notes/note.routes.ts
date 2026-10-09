import {
  createNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
} from '@fieldmate/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/require-role.js';
import { validate, validated } from '../../middleware/validate.js';
import { actor, taskIdOf } from '../tasks/task.controller.js';
import type { TaskRepository } from '../tasks/task.repository.js';
import { createNoteService } from './note.service.js';

const noteParamsSchema = z.strictObject({
  taskId: z.uuid('Task was not found.'),
  noteId: z.uuid('Note was not found.'),
});

/** Mounted under /tasks/:taskId/notes (docs/05 §7.19). */
export function createNoteRouter(deps: { repository: TaskRepository }): Router {
  const service = createNoteService(deps);
  const noteId = (req: Parameters<RequestHandler>[0]) =>
    validated<{ noteId: string }>(req, 'params').noteId;

  const create: RequestHandler = async (req, res) => {
    const { content } = validated<CreateNoteInput>(req);
    const note = await service.create(actor(req), taskIdOf(req), content);
    res.status(201).json(note);
  };

  const update: RequestHandler = async (req, res) => {
    const { content } = validated<UpdateNoteInput>(req);
    res.json(await service.update(actor(req), taskIdOf(req), noteId(req), content));
  };

  const remove: RequestHandler = async (req, res) => {
    await service.remove(actor(req), taskIdOf(req), noteId(req));
    res.status(204).end();
  };

  const router = Router({ mergeParams: true });
  router.post('/', requireRole('FIELD_WORKER'), validate(createNoteSchema), create);

  // Editing and deleting are the author's own, which the service enforces: a
  // note belonging to someone else is reported as missing (docs/02 F-007).
  const withNoteId = validate(noteParamsSchema, 'params');
  router.patch(
    '/:noteId',
    requireRole('FIELD_WORKER'),
    withNoteId,
    validate(updateNoteSchema),
    update,
  );
  router.delete('/:noteId', requireRole('FIELD_WORKER'), withNoteId, remove);
  return router;
}
