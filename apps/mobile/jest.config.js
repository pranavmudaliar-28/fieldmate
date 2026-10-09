/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  /**
   * Rendering a screen through the router and React Query takes about a second
   * on an idle machine, which leaves no margin against Jest's 5s default. Under
   * load — CI, or `npm test` running four workspaces — the six slowest tests
   * crossed it and the suite failed for no reason but timing. Reproduce the
   * old behaviour with `npx jest --testTimeout=5000 --maxWorkers=100%`.
   */
  testTimeout: 20000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Tests live under src/ only: every file in app/ is treated as a route by Expo Router.
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    // Test against shared sources so a shared build is not required.
    '^@fieldmate/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
