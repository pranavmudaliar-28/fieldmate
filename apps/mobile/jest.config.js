/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Tests live under src/ only: every file in app/ is treated as a route by Expo Router.
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    // Test against shared sources so a shared build is not required.
    '^@fieldmate/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
