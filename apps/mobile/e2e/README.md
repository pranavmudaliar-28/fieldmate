# End-to-end flows (Maestro)

These flows drive the real app on a device or emulator, against a real API,
database and storage.

## What each flow covers

| Flow                        | Covers                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `critical-flow.yaml`        | The critical path from the spec: manager creates and assigns → worker starts, photographs, adds a note, completes → manager reviews. Also checks that completing is blocked until there is a photo. |
| `worker-rejects-task.yaml`  | Worker rejects with a required reason → the task leaves their list → the manager sees it under "Needs attention" with the reason → reassigns it to another worker.                                  |
| `login.yaml`, `logout.yaml` | Shared steps used by the flows above.                                                                                                                                                               |

## Prerequisites

1. **Local services and a clean database with demo accounts**

   ```sh
   docker compose up -d
   npm run db:reset -w @fieldmate/api
   npm run db:seed -w @fieldmate/api
   npm run dev -w @fieldmate/api
   ```

2. **Maestro** — install from https://maestro.dev (needs Java, which is already
   installed on this machine).

3. **A development build** on the emulator or phone. Expo Go cannot be used:
   push notifications and the camera need a development build.

   ```sh
   npm i -g eas-cli
   eas login
   eas init            # run inside apps/mobile; adds the EAS project id
   eas build --profile development --platform android
   ```

   Install the resulting APK, then start the bundler with `npm run start -w @fieldmate/mobile`.

## Running

```sh
npm run e2e -w @fieldmate/mobile             # every flow
npm run e2e:critical -w @fieldmate/mobile    # the critical path only
```

## Notes

- The emulator's camera shows a simulated scene, which is enough for the photo
  step; the uploaded image is a real JPEG either way.
- Flows start with `clearState`, so each run signs in fresh.
- Re-seed between runs (`db:reset` then `db:seed`) so the task titles the flows
  assert on are unique.
