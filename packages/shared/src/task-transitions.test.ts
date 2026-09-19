import { describe, expect, it } from '@jest/globals';
import { TASK_STATUSES, type TaskStatus } from './constants.js';
import {
  TASK_ACTIONS,
  allowedActions,
  hasRequiredEvidence,
  isRoleAllowed,
  isStatusAllowed,
  nextStatus,
} from './task-transitions.js';

describe('task transitions (product spec T1–T7)', () => {
  it.each<[TaskStatus, string[]]>([
    ['ASSIGNED', ['edit', 'reassign', 'cancel']],
    ['IN_PROGRESS', ['edit', 'reassign', 'complete', 'cancel']],
    ['REJECTED', ['edit', 'reassign', 'cancel']],
    ['COMPLETED', ['reopen']],
    ['CANCELLED', []],
  ])('manager actions in %s', (status, expected) => {
    expect(allowedActions(status, 'MANAGER')).toEqual(expected);
  });

  it.each<[TaskStatus, string[]]>([
    ['ASSIGNED', ['start', 'reject']],
    ['IN_PROGRESS', ['complete', 'addEvidence', 'deleteEvidence', 'addNote']],
    ['REJECTED', []],
    ['COMPLETED', []],
    ['CANCELLED', []],
  ])('field worker actions in %s', (status, expected) => {
    expect(allowedActions(status, 'FIELD_WORKER')).toEqual(expected);
  });

  it('CANCELLED is final: no action is allowed from it', () => {
    for (const action of Object.keys(TASK_ACTIONS) as (keyof typeof TASK_ACTIONS)[]) {
      expect(isStatusAllowed(action, 'CANCELLED')).toBe(false);
    }
  });

  it('maps actions to their resulting status', () => {
    expect(nextStatus('start')).toBe('IN_PROGRESS');
    expect(nextStatus('reject')).toBe('REJECTED');
    expect(nextStatus('reassign')).toBe('ASSIGNED');
    expect(nextStatus('complete')).toBe('COMPLETED');
    expect(nextStatus('cancel')).toBe('CANCELLED');
    expect(nextStatus('reopen')).toBe('ASSIGNED');
    expect(nextStatus('edit')).toBeNull();
    expect(nextStatus('addNote')).toBeNull();
  });

  it('only workers can start, reject or add evidence and notes', () => {
    for (const action of ['start', 'reject', 'addEvidence', 'deleteEvidence', 'addNote'] as const) {
      expect(isRoleAllowed(action, 'FIELD_WORKER')).toBe(true);
      expect(isRoleAllowed(action, 'MANAGER')).toBe(false);
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

  it('completion requires at least one photo', () => {
    expect(hasRequiredEvidence(0)).toBe(false);
    expect(hasRequiredEvidence(1)).toBe(true);
    expect(hasRequiredEvidence(5)).toBe(true);
  });
});
