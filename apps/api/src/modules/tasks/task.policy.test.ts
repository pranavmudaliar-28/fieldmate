import { describe, expect, it } from '@jest/globals';
import { TASK_STATUSES, type TaskAction, type TaskStatus } from '@fieldmate/shared';
import type { AppError } from '../../utils/app-error.js';
import { assertCanPerform, assertCanViewTask, canViewTask, type Actor } from './task.policy.js';

const MANAGER: Actor = { id: 'manager-1', name: 'Anita Rao', role: 'MANAGER' };
const WORKER: Actor = { id: 'worker-1', name: 'Priya Nair', role: 'FIELD_WORKER' };
const OTHER_WORKER: Actor = { id: 'worker-2', name: 'Sam Lee', role: 'FIELD_WORKER' };

const task = (status: TaskStatus, currentWorkerId = WORKER.id) => ({ status, currentWorkerId });

function errorFrom(fn: () => void): AppError {
  try {
    fn();
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Expected the policy to reject this action.');
}

describe('task visibility', () => {
  it('lets managers view every task', () => {
    for (const status of TASK_STATUSES) {
      expect(canViewTask(MANAGER, task(status))).toBe(true);
    }
  });

  it('lets the assigned worker view their task', () => {
    expect(canViewTask(WORKER, task('ASSIGNED'))).toBe(true);
  });

  it('hides a task from a worker who does not hold it', () => {
    expect(canViewTask(OTHER_WORKER, task('ASSIGNED'))).toBe(false);
    expect(errorFrom(() => assertCanViewTask(OTHER_WORKER, task('ASSIGNED'))).code).toBe(
      'TASK_NOT_FOUND',
    );
  });
});

describe('manager actions', () => {
  it.each<[TaskAction, TaskStatus]>([
    ['edit', 'ASSIGNED'],
    ['edit', 'IN_PROGRESS'],
    ['edit', 'REJECTED'],
    ['reassign', 'ASSIGNED'],
    ['reassign', 'IN_PROGRESS'],
    ['reassign', 'REJECTED'],
    ['cancel', 'ASSIGNED'],
    ['cancel', 'IN_PROGRESS'],
    ['cancel', 'REJECTED'],
    ['reopen', 'COMPLETED'],
    ['complete', 'IN_PROGRESS'],
  ])('allows %s when the task is %s', (action, status) => {
    expect(() => assertCanPerform(action, MANAGER, task(status))).not.toThrow();
  });

  it.each<[TaskAction, TaskStatus]>([
    ['edit', 'COMPLETED'],
    ['edit', 'CANCELLED'],
    ['reassign', 'COMPLETED'],
    ['reassign', 'CANCELLED'],
    ['cancel', 'COMPLETED'],
    ['cancel', 'CANCELLED'],
    ['reopen', 'ASSIGNED'],
    ['reopen', 'CANCELLED'],
    ['complete', 'ASSIGNED'],
    ['complete', 'COMPLETED'],
  ])('rejects %s when the task is %s', (action, status) => {
    expect(errorFrom(() => assertCanPerform(action, MANAGER, task(status))).code).toBe(
      'INVALID_STATUS_TRANSITION',
    );
  });

  it.each<TaskAction>(['start', 'reject', 'addEvidence', 'deleteEvidence', 'addNote'])(
    'forbids managers from the worker-only action %s',
    (action) => {
      expect(errorFrom(() => assertCanPerform(action, MANAGER, task('IN_PROGRESS'))).code).toBe(
        'FORBIDDEN',
      );
    },
  );
});

describe('worker actions', () => {
  it('allows the assigned worker to start and reject an assigned task', () => {
    expect(() => assertCanPerform('start', WORKER, task('ASSIGNED'))).not.toThrow();
    expect(() => assertCanPerform('reject', WORKER, task('ASSIGNED'))).not.toThrow();
  });

  it('allows evidence, notes and completion while in progress', () => {
    for (const action of ['addEvidence', 'deleteEvidence', 'addNote', 'complete'] as TaskAction[]) {
      expect(() => assertCanPerform(action, WORKER, task('IN_PROGRESS'))).not.toThrow();
    }
  });

  it('does not allow rejecting a task that is already in progress', () => {
    expect(errorFrom(() => assertCanPerform('reject', WORKER, task('IN_PROGRESS'))).code).toBe(
      'INVALID_STATUS_TRANSITION',
    );
  });

  it.each<TaskAction>(['edit', 'reassign', 'cancel', 'reopen'])(
    'forbids workers from the manager-only action %s',
    (action) => {
      expect(errorFrom(() => assertCanPerform(action, WORKER, task('ASSIGNED'))).code).toBe(
        'FORBIDDEN',
      );
    },
  );

  it('reports another worker task as not found, not forbidden', () => {
    expect(errorFrom(() => assertCanPerform('start', OTHER_WORKER, task('ASSIGNED'))).code).toBe(
      'TASK_NOT_FOUND',
    );
  });

  it('never allows anything once a task is cancelled', () => {
    for (const action of ['start', 'complete', 'addNote'] as TaskAction[]) {
      expect(errorFrom(() => assertCanPerform(action, WORKER, task('CANCELLED'))).code).toBe(
        'INVALID_STATUS_TRANSITION',
      );
    }
  });
});
