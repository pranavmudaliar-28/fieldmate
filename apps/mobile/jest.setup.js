// Public config the app reads at runtime; tests never talk to a real server.
process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

// Screens are rendered without the app shell, so the safe-area provider is not
// mounted. The library ships a mock with zero insets for exactly this case.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
