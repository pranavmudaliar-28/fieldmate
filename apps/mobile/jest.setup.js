// Public config the app reads at runtime; tests never talk to a real server.
process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
