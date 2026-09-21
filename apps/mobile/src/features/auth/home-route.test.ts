import { canEnterRouteGroup, homeRouteFor } from './home-route';

describe('homeRouteFor', () => {
  it.each([
    ['ADMIN', '/(admin)'],
    ['MANAGER', '/(manager)'],
    ['FIELD_WORKER', '/(worker)'],
  ] as const)('sends %s to %s', (role, route) => {
    expect(homeRouteFor(role)).toBe(route);
  });
});

describe('canEnterRouteGroup', () => {
  it('lets each role into its own area', () => {
    expect(canEnterRouteGroup('ADMIN', 'ADMIN')).toBe(true);
    expect(canEnterRouteGroup('MANAGER', 'MANAGER')).toBe(true);
    expect(canEnterRouteGroup('FIELD_WORKER', 'FIELD_WORKER')).toBe(true);
  });

  it('lets an admin into the manager area, since they hold those powers', () => {
    expect(canEnterRouteGroup('ADMIN', 'MANAGER')).toBe(true);
  });

  it('keeps everyone else out of areas that are not theirs', () => {
    expect(canEnterRouteGroup('MANAGER', 'ADMIN')).toBe(false);
    expect(canEnterRouteGroup('FIELD_WORKER', 'ADMIN')).toBe(false);
    expect(canEnterRouteGroup('FIELD_WORKER', 'MANAGER')).toBe(false);
    expect(canEnterRouteGroup('MANAGER', 'FIELD_WORKER')).toBe(false);
    // Worker screens act on the signed-in worker's own tasks, so not even an admin.
    expect(canEnterRouteGroup('ADMIN', 'FIELD_WORKER')).toBe(false);
  });
});
