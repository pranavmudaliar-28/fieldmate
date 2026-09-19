const common = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Test against shared sources so a shared build is not required.
    '^@fieldmate/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
};

/** @type {import('jest').Config} */
export default {
  projects: [
    {
      ...common,
      displayName: 'unit',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.test.ts'],
    },
    {
      ...common,
      displayName: 'integration',
      roots: ['<rootDir>/test'],
      testMatch: ['**/*.int.test.ts'],
      // Integration tests share one database and truncate between cases, so they
      // must run serially. Jest ignores maxWorkers inside a project config, so
      // the "test:int" script passes --runInBand.
      globalSetup: '<rootDir>/test/global-setup.ts',
    },
  ],
};
