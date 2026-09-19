import type {
  CreateTaskInput,
  ListTasksQuery,
  ReassignTaskInput,
  UpdateTaskInput,
} from '@fieldmate/shared';
import type { Request, RequestHandler } from 'express';
import { validated } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import { decodeCursor } from '../../utils/cursor.js';
import type { Actor } from './task.policy.js';
import type { TaskService } from './task.service.js';

function actor(req: Request): Actor {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
  return { id: req.user.id, role: req.user.role };
}

function taskId(req: Request): string {
  return validated<{ taskId: string }>(req, 'params').taskId;
}

export function createTaskController(service: TaskService) {
  const list: RequestHandler = async (req, res) => {
    const query = validated<ListTasksQuery>(req, 'query');
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    res.json(await service.list(actor(req), query, cursor));
  };

  const create: RequestHandler = async (req, res) => {
    const input = validated<CreateTaskInput>(req);
    res.status(201).json(await service.create(actor(req), input));
  };

  const get: RequestHandler = async (req, res) => {
    res.json(await service.get(actor(req), taskId(req)));
  };

  const update: RequestHandler = async (req, res) => {
    const input = validated<UpdateTaskInput>(req);
    res.json(await service.update(actor(req), taskId(req), input));
  };

  const assign: RequestHandler = async (req, res) => {
    const { workerId } = validated<ReassignTaskInput>(req);
    res.json(await service.reassign(actor(req), taskId(req), workerId));
  };

  const cancel: RequestHandler = async (req, res) => {
    res.json(await service.cancel(actor(req), taskId(req)));
  };

  const reopen: RequestHandler = async (req, res) => {
    res.json(await service.reopen(actor(req), taskId(req)));
  };

  const complete: RequestHandler = async (req, res) => {
    res.json(await service.complete(actor(req), taskId(req)));
  };

  return { list, create, get, update, assign, cancel, reopen, complete };
}
