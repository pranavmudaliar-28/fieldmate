import { describe, expect, it } from '@jest/globals';
import { TASK_STATUSES, WORKER_PROGRESS_STATUSES, type TaskStatus } from './constants.js';
import {
  TASK_ACTIONS,
  WORKER_STEPS,
  allowedActions,
  hasRequiredEvidence,
  isRoleAllowed,
  isStatusAllowed,
  nextStatus,
  nextWorkerStep,
  previousStatus,
} from './task-transitions.js';

describe('task transitions (product spec T1–T7)', () => {
  it.each<[TaskStatus, string[]]>([
    ['ASSIGNED', ['edit', 'reassign', 'cancel']],
    ['ACCEPTED', ['edit', 'reassign', 'cancel']],
    ['GOING_TO_LOCATION', ['edit', 'reassign', 'cancel']],
    ['REACHED_LOCATION', ['edit', 'reassign', 'cancel']],
    ['IN_PROGRESS', ['edit', 'reassign', 'complete', 'cancel']],
    ['REJECTED', ['edit', 'reassign', 'cancel']],
    ['COMPLETED', ['reopen']],
    ['CANCELLED', []],
  ])('manager actions in %s', (status, expected) => {
    expect(allowedActions(status, 'MANAGER')).toEqual(expected);
  });

  it.each<[TaskStatus, string[]]>([
    ['ASSIGNED', ['accept', 'reject']],
    ['ACCEPTED', ['depart', 'stepBack', 'reject']],
    ['GOING_TO_LOCATION', ['arrive', 'stepBack', 'reject']],
    ['REACHED_LOCATION', ['start', 'stepBack', 'reject']],
    ['IN_PROGRESS', ['complete', 'addEvidence', 'deleteEvidence', 'addNote']],
    ['REJECTED', []],
    ['COMPLETED', []],
    ['CANCELLED', []],
  ])('field worker actions in %s', (status, expected) => {
    expect(allowedActions(status, 'FIELD_WORKER')).toEqual(expected);
  });

  /**
   * The rule the whole lifecycle exists to enforce: assigning or accepting a
   * task must never put it into IN_PROGRESS.
   */
  it('only reaches IN_PROGRESS through start, and only after arriving', () => {
    const intoProgress = Object.entries(TASK_ACTIONS).filter(
      ([, rule]) => rule.to === 'IN_PROGRESS',
    );
    expect(intoProgress.map(([name]) => name)).toEqual(['start']);
    expect(TASK_ACTIONS.start.from).toEqual(['REACHED_LOCATION']);
  });

  it('walks the steps in order', () => {
    expect(WORKER_STEPS).toEqual(['accept', 'depart', 'arrive', 'start']);
    expect(nextWorkerStep('ASSIGNED')).toBe('accept');
    expect(nextWorkerStep('ACCEPTED')).toBe('depart');
    expect(nextWorkerStep('GOING_TO_LOCATION')).toBe('arrive');
    expect(nextWorkerStep('REACHED_LOCATION')).toBe('start');
  });

  it('has no next step once the work is under way or over', () => {
    for (const status of ['IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const) {
      expect(nextWorkerStep(status)).toBeNull();
    }
  });

  it('steps back one status at a time, and never out of work or assignment', () => {
    expect(previousStatus('ACCEPTED')).toBe('ASSIGNED');
    expect(previousStatus('GOING_TO_LOCATION')).toBe('ACCEPTED');
    expect(previousStatus('REACHED_LOCATION')).toBe('GOING_TO_LOCATION');
    for (const status of ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const) {
      expect(previousStatus(status)).toBeNull();
    }
  });

  /** Arriving and finding a locked gate is the realistic rejection. */
  it('allows rejecting at any point before the work starts', () => {
    for (const status of [
      'ASSIGNED',
      'ACCEPTED',
      'GOING_TO_LOCATION',
      'REACHED_LOCATION',
    ] as const) {
      expect(isStatusAllowed('reject', status)).toBe(true);
    }
    expect(isStatusAllowed('reject', 'IN_PROGRESS')).toBe(false);
  });

  it('CANCELLED is final: no action is allowed from it', () => {
    for (const action of Object.keys(TASK_ACTIONS) as (keyof typeof TASK_ACTIONS)[]) {
      expect(isStatusAllowed(action, 'CANCELLED')).toBe(false);
    }
  });

  it('maps actions to their resulting status', () => {
    expect(nextStatus('accept')).toBe('ACCEPTED');
    expect(nextStatus('depart')).toBe('GOING_TO_LOCATION');
    expect(nextStatus('arrive')).toBe('REACHED_LOCATION');
    expect(nextStatus('start')).toBe('IN_PROGRESS');
    expect(nextStatus('reject')).toBe('REJECTED');
    expect(nextStatus('reassign')).toBe('ASSIGNED');
    expect(nextStatus('complete')).toBe('COMPLETED');
    expect(nextStatus('cancel')).toBe('CANCELLED');
    expect(nextStatus('reopen')).toBe('ASSIGNED');
    expect(nextStatus('edit')).toBeNull();
    expect(nextStatus('stepBack')).toBeNull();
    expect(nextStatus('addNote')).toBeNull();
  });

  it('only workers walk the lifecycle, add evidence or add notes', () => {
    const workerOnly = [
      ...WORKER_STEPS,
      'stepBack',
      'reject',
      'addEvidence',
      'deleteEvidence',
      'addNote',
    ] as const;
    for (const action of workerOnly) {
      expect(isRoleAllowed(action, 'FIELD_WORKER')).toBe(true);
      expect(isRoleAllowed(action, 'MANAGER')).toBe(false);
      expect(isRoleAllowed(action, 'ADMIN')).toBe(false);
    }
  });

  it('both roles can complete', () => {
    expect(isRoleAllowed('complete', 'MANAGER')).toBe(true);
    expect(isRoleAllowed('complete', 'FIELD_WORKER')).toBe(true);
  });

  it('every action references valid statuses', () => {
    for (const rule of Object.values(TASK_ACTIONS)) {
      for (const status of rule.from) expect(TASK_STATUSES).toContain(status);
      if (rule.to !== null) expect(TASK_STATUSES).toContain(rule.to);
    }
  });

  it('a manager can intervene at every live step', () => {
    for (const status of WORKER_PROGRESS_STATUSES) {
      expect(isStatusAllowed('cancel', status)).toBe(true);
      expect(isStatusAllowed('reassign', status)).toBe(true);
    }
  });

  it('completion requires at least one photo', () => {
    expect(hasRequiredEvidence(0)).toBe(false);
    expect(hasRequiredEvidence(1)).toBe(true);
    expect(hasRequiredEvidence(5)).toBe(true);
  });
});
