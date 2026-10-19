// Public config the app reads at runtime; tests never talk to a real server.
process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

// Screens are rendered without the app shell, so the safe-area provider is not
// mounted. The library ships a mock with zero insets for exactly this case.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Nothing in a test has a radio. The library ships a mock that reports a
// working connection, which is the state every screen is written against.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// The offline queue persists to the document directory, which no test has.
// Everything that decides what the queue does is tested directly in
// src/features/offline/sync.test.ts; here it only has to start empty.
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///document/' },
  Directory: class {
    constructor() {
      this.exists = true;
      this.uri = 'file:///document/offline/';
    }
    create() {}
  },
  File: class {
    constructor() {
      this.exists = false;
      this.uri = 'file:///document/offline/queue.json';
      this.size = 0;
    }
    create() {}
    write() {}
    async text() {
      return '{}';
    }
    delete() {}
    async copy() {}
  },
}));
