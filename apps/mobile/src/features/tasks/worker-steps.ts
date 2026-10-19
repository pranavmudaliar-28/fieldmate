import type { WorkerStep } from '@fieldmate/shared';
import type { IconName } from '../../constants/theme';

/**
 * The worker's forward steps, as the buttons that take them. A task only
 * becomes "In progress" through `start`, which is offered once they have
 * confirmed arrival — never on assignment and never on acceptance. Shared by
 * the task screen and the home card so the same step always reads the same.
 */
export const WORKER_STEP_UI: Record<
  WorkerStep,
  { label: string; icon: IconName; done: string; next: string }
> = {
  accept: {
    label: 'Accept task',
    icon: 'checkmark',
    done: 'Task accepted',
    next: 'Next: accept it, then head to the site',
  },
  depart: {
    label: 'I’m on my way',
    icon: 'navigate-outline',
    done: 'On your way',
    next: 'Next: tell your manager you’re on your way',
  },
  arrive: {
    label: 'I’ve arrived',
    icon: 'location-outline',
    done: 'Arrival confirmed',
    next: 'Next: confirm you’ve reached the site',
  },
  start: {
    label: 'Start work',
    icon: 'hammer-outline',
    done: 'Work started',
    next: 'Next: start work, then add photos',
  },
};
