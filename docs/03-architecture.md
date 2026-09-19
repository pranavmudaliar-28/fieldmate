# FieldMate — Phase 3: Architecture

Status: **Draft for approval**
Date: 2026-09-16
Inputs: [02-product-specification.md](02-product-specification.md) (approved)

Tags: **[C]** confirmed in the original spec · **[D]** product-owner decision · **[T]** technical choice (doesn't change product behaviour) · **[Q]** open question (see §14)

---

## 1. System overview

```
┌──────────────────────────┐        HTTPS / JSON + multipart        ┌───────────────────────────────┐
│  Mobile app (Expo, RN)   │ ─────────────────────────────────────► │  API (Node, Express, TS)      │
│  iOS + Android           │ ◄───────────────────────────────────── │  /api/v1                      │
│  - SecureStore: JWT      │         Bearer token                   │  routes → controllers →       │
│  - Camera / Location     │                                        │  services → Drizzle           │
│  - expo-notifications    │                                        └───────┬───────────┬───────────┘
└─────────────▲────────────┘                                                │           │
              │ push                                                        │ SQL       │ S3 API (private)
              │                                                             ▼           ▼
      ┌───────┴────────┐      send (expo-server-sdk)                 ┌────────────┐ ┌──────────────────────┐
      │ Expo Push Svc  │ ◄────────────────────────────────────────── │ PostgreSQL │ │ S3-compatible bucket │
      │ (APNs / FCM)   │                                             └────────────┘ │ (MinIO dev, S3/R2)   │
      └────────────────┘                                                            └──────────────────────┘
```

- The mobile app **only** talks to the API. It never connects to PostgreSQL, S3 or storage credentials directly [C].
- **Photo upload:** the photo goes mobile → API (multipart) → API checks it → API writes it to the bucket → API saves the evidence record [C].
- **Photo viewing:** the API returns short-lived **presigned GET URLs** in the task details response, and the bucket stays private [T].
- **Push:** the API sends through the Expo Push Service after a successful change. Push failures never make the change fail [D] / [T].

---

## 2. Technology stack

Versions: use the **latest stable release when the project is set up** (Phase 6A), then pin them with a lockfile. Node **24 LTS** [T].

### 2.1 Workspace
| Concern | Choice | Why |
|---|---|---|
| Monorepo | **npm workspaces** | Comes with Node, so no extra tool; supported by Expo and Metro [T] |
| Language | TypeScript `strict: true` everywhere | [C] |
| Lint / format | ESLint + Prettier | Standard, and adds nothing to what the app ships [T] |

### 2.2 Shared package — `packages/shared`
| Library | Used for |
|---|---|
| `zod` | Request and form schemas (Create Task, Reject, Note, Login…) used by **both** the API and the mobile app [C: "shared validation strategy"] |

The package also holds plain TypeScript with no dependencies:
- the `Role` and `TaskStatus` enums
- the **task transition table** (§4.3), with `canTransition()` and `allowedActions(task, user)`
- API error codes
- response types (DTOs)

### 2.3 Mobile — `apps/mobile`
| Concern | Library | Notes |
|---|---|---|
| Framework | `expo`, `react-native`, `expo-router` | [C] |
| Server state | `@tanstack/react-query` | [C] |
| Session state | **React Context** (`AuthProvider`) | Only the session is global, so Zustand isn't needed [T] |
| Forms | `react-hook-form` + `@hookform/resolvers` (zod) | Lightweight, and uses the shared schemas [T] |
| Token storage | `expo-secure-store` | Keychain / Keystore [C] |
| Camera | `expo-camera` | [C] |
| Photo compression | `expo-image-manipulator` | Resize so the long edge is at most 2048 px, JPEG quality 0.7; re-encoding also **removes EXIF** data, including GPS [T] |
| Image display | `expo-image` | Caching and fast rendering [T] |
| Location | `expo-location` | Only the "Use current location" button [D] |
| Push | `expo-notifications`, `expo-device`, `expo-constants` | [D] |
| Network status | `@react-native-community/netinfo` | "You're offline" banner [C] |
| Open in Maps | React Native `Linking` (no library) | `geo:` / `maps:` / https fallback [D] |
| HTTP | Our own `fetch` wrapper; `XMLHttpRequest` only for photo upload, to show progress | No axios [T] |
| Bottom sheet, dialog, toast | Our own components built on RN `Modal` | Avoids adding gesture and animation libraries [T] |

### 2.4 API — `apps/api`
| Concern | Library | Notes |
|---|---|---|
| HTTP | `express` (v5) | [C]; v5 passes async errors to the error handler automatically |
| Validation | `zod` (from shared) | [C] |
| ORM / migrations | `drizzle-orm`, `drizzle-kit`, `pg` | [C] |
| Password hashing | `argon2` (argon2id) | Prebuilt binaries work on Windows and Linux [T] |
| Tokens | `jose` (JWT HS256) | Modern and maintained [T] |
| Security headers | `helmet` | [C] |
| CORS | `cors` | Allow-list from env; empty by default, since native apps don't need CORS [T] |
| Login rate limit | `express-rate-limit` | Slows password guessing [T] |
| Multipart upload | `multer` (memory storage, 10 MB limit) | [D] |
| File type sniffing | `file-type` | Checks the file's actual bytes, not the client's `Content-Type` [T] |
| Object storage | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Works with S3, R2 and MinIO [D] |
| Push | `expo-server-sdk` | [D] |
| Logging | `pino`, `pino-http` | JSON logs; `Authorization`, `password` and `token` are hidden [T] |
| Dev runner | `tsx` | Watch mode in development [T] |

### 2.5 Testing
| Layer | Tooling |
|---|---|
| Unit (shared, API services and rules) | Jest [C] |
| API integration | Jest + `supertest` against a **real PostgreSQL** test database (Docker); storage and push are replaced with in-memory fakes [C] / [T] |
| Mobile components and screens | `jest-expo` + React Native Testing Library; the API service layer is mocked with Jest [C] |
| End-to-end | **Maestro** on the Android emulator against a development build and a seeded local API [T]; Java is already installed |

### 2.6 Infrastructure
| Concern | Choice |
|---|---|
| Local services | **Docker Desktop**: `docker-compose.yml` runs `postgres` and `minio` (+ bucket setup), plus a separate test database [D] |
| API packaging | Multi-stage `Dockerfile` that doesn't depend on any host [D] |
| Staging / production hosting | **Deferred.** Any container host, managed PostgreSQL and S3-compatible bucket will work [D] |
| Mobile builds | **EAS Build**: `development`, `staging` and `production` profiles [D] |
| Development device | Android emulator (Google Play system image, so FCM push works) [D] |

### 2.7 Machine setup needed before Phase 6A
Currently installed: Git and Java. **Missing:** Node.js 24 LTS, Docker Desktop, Android Studio (emulator), and the EAS CLI (`npm i -g eas-cli`).
Accounts needed: an Expo account; a Firebase project (FCM credentials for Android push); an Apple Developer account (for iOS builds and push, can come later).

---

## 3. Mobile architecture

### 3.1 Layers [C]
```
app/ (Expo Router screens: layout, reading the route, wiring)
  ↓ uses
src/features/<feature>/components   ← feature UI
src/features/<feature>/hooks        ← TanStack Query hooks (useTask, useStartTask…)
  ↓ call
src/features/<feature>/api.ts       ← typed endpoint functions
  ↓ use
src/services/http.ts                ← fetch wrapper: base URL, bearer token, error parsing, 401 handling
```
- Screens don't contain business logic. Which actions to show comes from the shared `allowedActions()`, so the app's buttons follow the same rules as the server.
- `src/components/` holds reusable UI pieces: Button, Input, TextArea, Select, Card, Badge, Avatar, TaskCard, StatusBadge, SectionHeader, LoadingState, EmptyState, ErrorState, ConfirmationDialog, BottomSheet, PhotoPreview, PermissionPrompt.
- `src/constants/theme.ts` holds colours, type scale and spacing from the design spec (detailed in Phase 4).

### 3.2 Feature folders
| Folder | Contains |
|---|---|
| `features/auth` | `AuthProvider` (context), `useLogin`, `useLogout`, session bootstrap, token storage |
| `features/tasks` | List, detail, create, edit, start, reject, cancel, reopen, complete hooks and components |
| `features/assignments` | Worker picker, reassign hook |
| `features/evidence` | Camera screen logic, compression, upload with progress, delete photo |
| `features/notes` | Add note form and hook, notes list |
| `features/location` | "Use current location" hook, Open in Maps helper |
| `features/notifications` | Asking permission, registering and removing the push token, handling taps on a push |

### 3.3 Server state (TanStack Query)
- **Query keys:** `['tasks', 'list', filters]`, `['tasks', 'detail', id]`, `['users', 'workers']`, `['me']`.
- **After a change:** the API returns the updated task; the app writes it into `['tasks','detail',id]` and refreshes `['tasks','list']`. There are **no optimistic updates**, because status changes can be refused by the server (409).
- **Refreshing:** data refreshes when the screen is focused, when the app comes back to the foreground, and when the connection returns (through NetInfo). A task's detail refreshes when a push for that task arrives.
- **Lists:** `useInfiniteQuery` with cursor-based pagination.
- **Retries:** failed reads retry at most 2 times, and 4xx errors don't retry. Changes never retry automatically.

### 3.4 Session and navigation guard
1. When the app starts, `AuthProvider` reads the token from SecureStore and calls `GET /users/me`.
   - On success, the session is kept.
   - On a 401, the token is cleared.
   - On a network error, the app shows an offline message with a retry.
2. `app/_layout.tsx` redirects: no session goes to `(auth)/login`; `MANAGER` goes to `(manager)`; `FIELD_WORKER` goes to `(worker)`. Each group's `_layout` checks the role again.
3. **Logout:** remove this device's push token from the server (best effort), clear SecureStore, clear the query cache, go to Login.
4. **Any 401 from the API** triggers the same local logout, with a "session expired" message.
5. **The role always comes from `/users/me` or the login response,** never from decoding the JWT on the device [C].

### 3.5 Photo pipeline
Camera permission → `CameraView.takePictureAsync` → preview → `manipulateAsync(resize, JPEG 0.7)` → size check (≤10 MB) → `XMLHttpRequest` multipart POST with progress → on success, refresh the task detail.

---

## 4. Backend architecture

### 4.1 Layers [C]
```
routes/        path + middleware chain (auth, role, validate)
controllers/   read the validated input and req.user → call a service → send the response DTO   (thin)
services/      business rules, authorization checks, transactions, side effects after commit
repositories/  Drizzle queries (inside each module; services never write SQL directly)
db/            Drizzle client, schema, migrations
```

### 4.2 Module layout
```
src/modules/
  auth/         login
  users/        GET /users/me, GET /users?role=, push token register/remove
  tasks/        list, get, create, patch, start, reject, cancel, reopen, complete
                + task.policy.ts (who can see or act on which task)
  assignments/  reassign (POST /tasks/:id/assignment)
  evidence/     upload, delete
  notes/        create
src/services/
  storage/      StorageService interface → S3StorageService | InMemoryStorageService (tests)
  push/         PushService interface → ExpoPushService | FakePushService (tests)
src/middleware/ requestId, logger, authenticate, requireRole, validate, upload, rateLimit, notFound, errorHandler
src/config/     env.ts (Zod-checked, stops at startup if invalid)
src/utils/      AppError, password, jwt, pagination cursor
src/app.ts      builds the Express app (used by tests without opening a port)
src/server.ts   starts listening and shuts down cleanly
```
**Dependency injection:** `createApp({ db, storage, push, config })`. No DI framework, just parameters, so tests can pass in fakes [T].

### 4.3 Task state machine (one source of truth)
`packages/shared/src/task-transitions.ts` encodes rules T1–T7 from the product spec as data: action → allowed from-statuses → to-status → allowed actors.
- **API:** `task.service` uses the table to decide whether an action is allowed. When it isn't, the response is `409 INVALID_STATUS_TRANSITION`, or `403 FORBIDDEN` if the role or ownership check fails.
- **Mobile:** uses the same table to decide which buttons to show. The UI is only a convenience; the API is what enforces the rules [C].

### 4.4 Data consistency and concurrency
Every status-changing action runs in **one database transaction**:
1. `SELECT … FROM tasks WHERE id = $1 FOR UPDATE` (locks the task row).
2. Check access, role and the transition.
3. Check the action's condition. For **complete**, `COUNT(task_evidence) ≥ 1` is checked while holding the lock. Photo deletion takes the same lock, so a delete and a complete can't slip past each other.
4. Write the change (status, assignment row, `completed_at`, `updated_at`).
5. Commit, **then** send pushes asynchronously. Errors are logged and never returned to the caller.

**Photo upload** checks for the IN_PROGRESS status and assigned worker under the lock, writes the object to storage, then inserts the evidence row. If the insert fails, the object is deleted (best effort).

### 4.5 Error handling
- `AppError(status, code, message)` is thrown from services.
- One central `errorHandler` turns it into `{ "error": { "code", "message" } }` [C].
- **Zod validation errors** return 422 `VALIDATION_ERROR`. **Malformed JSON or an invalid UUID in the path** returns 400 `INVALID_REQUEST`. **Anything unknown** returns 500 `INTERNAL_ERROR` with a generic message; the full error goes to the logs with the request ID, never to the client [C].
- Whether to add a field-level `details` array to 422 responses is decided in Phase 5.

### 4.6 Notifications
`PushService.send(userIds, { title, body, data: { taskId, type } })`:
1. Look up the users' `device_push_tokens`.
2. Send them in chunks through `expo-server-sdk`.
3. Delete tokens Expo reports as `DeviceNotRegistered`.

Triggers exist only in `task.service` and `assignments.service`, and match the product spec §6.3 exactly. There's no message queue: pushes are sent in-process after commit [T]. Checking Expo's delivery receipts isn't included.

---

## 5. Database architecture

- **PostgreSQL** (latest stable major), **Drizzle ORM**, **UUID** primary keys generated by the database (`gen_random_uuid()`), `timestamptz` everywhere, UTC [C] / [T].
- **Schema** lives in `apps/api/src/db/schema/*.ts`. **Migrations** are generated with `drizzle-kit generate` and stored as SQL files in `apps/api/drizzle/`, which are **committed** and reviewed.
- **Migrations run as an explicit step** (`npm run db:migrate`), before the new API version starts. They never run automatically when the API starts [T].
- **Postgres enums:** `user_role`, `task_status`.
- **Constraints** protect integrity: foreign keys, `NOT NULL`, `UNIQUE (users.email)` (case-insensitive), `UNIQUE (task_locations.task_id)`, and CHECK constraints for latitude/longitude ranges and "both or neither".
- **Changes from the original data model, already approved in Phases 1–2** (exact DDL in Phase 5):
  - `tasks.location_id` is removed.
  - `task_notes.updated_at` is removed.
  - The rejection reason and time are stored on `task_assignments`.
  - A new `device_push_tokens` table.
  - `tasks.status` uses the 5-value enum.
- **Proposed for Phase 5** (technical, to be justified there):
  - A pagination index on `tasks(updated_at, id)`.
  - `task_evidence.file_url` storing the **object key** rather than a public URL, because the bucket is private and URLs are presigned per request.

---

## 6. API architecture

- REST, JSON, base path `/api/v1` [C]. Photo upload uses `multipart/form-data`.
- **Endpoints:** the confirmed set from Phase 1 §4b. Exact request and response contracts come in Phase 5.
- **Responses:**
  - A single resource is returned as the object itself.
  - Lists are returned as `{ items, nextCursor }`.
  - `GET /tasks/:id` returns the task with its location, current assignment (plus the latest rejection), evidence (with presigned URLs), and notes (with author names), fetched in a fixed number of queries with no N+1 problem [C].
- **Pagination:** cursor based on `(updated_at, id)`, default page size 20, maximum 50 [T].
- **List endpoint rules:** `GET /tasks` is filtered on the server by role. Managers can filter by `status`. For workers the server always limits the list to *their current assignment and status ∈ {ASSIGNED, IN_PROGRESS, COMPLETED}*, whatever the query says [D].
- **Operational endpoint [D]:** `GET /health`, not under `/api/v1` and with no authentication. It's needed by container hosts for liveness checks and returns only `{status:"ok"}`.
- **Request limits:** JSON body 100 KB; upload 10 MB, one file per request.

---

## 7. Authentication architecture

| Aspect | Design |
|---|---|
| Login | `POST /auth/login` {email, password}. The email is trimmed and lowercased. **Argon2id** verifies the password. If the user doesn't exist, the password is still hashed against a dummy value so response timing doesn't reveal which emails exist. Both failures return 401 `INVALID_CREDENTIALS` [C] / [T] |
| Token | JWT HS256 signed with `AUTH_SECRET` (≥32 bytes of randomness). Claims: `sub` (user id), `iat`, `exp` = 7 days, `iss`/`aud` = `fieldmate-api` / `fieldmate-mobile` + `APP_ENV`, so a staging token is **rejected** by production [D] / [T] |
| Per request | The `authenticate` middleware checks the signature, expiry, issuer and audience, then **loads the user from the database** by `sub`. The role comes from the database, not the token, so a role change or deleted user takes effect immediately [C] |
| Storage on device | `expo-secure-store` only. The token is never put in AsyncStorage or logged [C] |
| Rate limit | `/auth/login`: 10 attempts per 15 minutes per IP + email [T] |
| Logout | `POST /auth/logout` increments `users.token_version` and removes this device's push token. The app then deletes the stored token. JWTs carry a `ver` claim; `authenticate` rejects a token whose `ver` doesn't match the user's current `token_version`. **Logout signs the user out on every device** [D] |
| Admin revoke | CLI `user:revoke-sessions -- --email …` increments `token_version` (e.g. for a lost phone) [D] |
| Account creation | CLI: `npm run -w apps/api user:create -- --email … --name … --role MANAGER|FIELD_WORKER`, which prompts for the password without showing it. A development-only `db:seed` creates demo accounts and **refuses to run when `APP_ENV` is `staging` or `production`** [D] |
| Not built | Registration, password reset, email verification, refresh tokens, account deletion [D] |

---

## 8. Authorization architecture (RBAC plus task access)

Three layers, all enforced on the server [C]:

1. **Route-level role check** (`requireRole`):
   - Managers only: create, patch, reassign, cancel, reopen, list workers.
   - Workers only: start, reject, upload photo, delete photo, add note.
   - Both roles: list, get, complete.
2. **Task access** (`task.policy.ts`):
   - `canViewTask(user, task)` is true for a manager, or for a worker who is the task's **current** assignee.
   - For workers, a task they can't view returns **404 `TASK_NOT_FOUND`**, so the response doesn't reveal that the task exists [T].
3. **Action rules** (shared transition table plus conditions):
   - The status must allow the action.
   - The actor must be the current assignee where required.
   - Photo deletion requires `uploaded_by = user`.
   - Completion requires at least 1 photo.

| Action | Role | Ownership | Status | Extra condition |
|---|---|---|---|---|
| List tasks | M, W | W: current assignee | M: any; W: ASSIGNED/IN_PROGRESS/COMPLETED | — |
| Get task | M, W | W: current assignee | any | — |
| Create | M | — | → ASSIGNED | Worker exists and has the FIELD_WORKER role |
| Edit (PATCH) | M | — | ASSIGNED/IN_PROGRESS/REJECTED | Only title, description, location |
| Reassign | M | — | ASSIGNED/IN_PROGRESS/REJECTED | New worker must differ from the current worker unless the task is REJECTED |
| Start | W | current assignee | ASSIGNED | — |
| Reject | W | current assignee | ASSIGNED | Reason required |
| Upload photo | W | current assignee | IN_PROGRESS | JPEG/PNG (checked by content), ≤10 MB |
| Delete photo | W | current assignee + uploader | IN_PROGRESS | — |
| Add note | W | current assignee | IN_PROGRESS | — |
| Complete | M, W | W: current assignee | IN_PROGRESS | ≥1 photo |
| Cancel | M | — | ASSIGNED/IN_PROGRESS/REJECTED | — |
| Reopen | M | — | COMPLETED | — |
| List workers | M | — | — | — |
| Register/remove push token | M, W | own tokens only | — | — |

The same rules are covered by unit tests (policy functions) and API tests for every row (§12).

---

## 9. File storage architecture

| Aspect | Design |
|---|---|
| Buckets | One **private** bucket per environment, e.g. `fieldmate-dev`, `fieldmate-staging`, `fieldmate-prod` [C] / [T] |
| Object key | `tasks/{taskId}/evidence/{evidenceId}.{jpg|png}`, generated by the server; file names from the client are ignored [T] |
| Checks | Multer size limit of 10 MB → `file-type` confirms the bytes are `image/jpeg` or `image/png` → otherwise 422 `INVALID_FILE` [D] |
| Reading photos | Presigned GET URLs valid for **15 minutes**, created when `GET /tasks/:id` runs [T] |
| Deleting | Delete the database row inside the transaction, then delete the object after commit (best effort; failures are logged) [D] / [T] |
| Credentials | Only the API has `FILE_STORAGE_*` variables. The mobile app never sees them [C] |
| EXIF | Removed when the app re-encodes the photo. The server doesn't re-encode, to avoid the heavy `sharp` dependency [T] |

---

## 10. Environment architecture

| | development | staging | production | test |
|---|---|---|---|---|
| API runs on | local (`tsx watch`) | container host (not chosen yet) | container host (not chosen yet) | Jest (in-process) |
| Database | Docker `fieldmate_dev` | managed Postgres, **separate instance/project** | managed Postgres, **separate instance/project** | Docker `fieldmate_test` |
| Storage | MinIO `fieldmate-dev` | bucket `fieldmate-staging` + its own credentials | bucket `fieldmate-prod` + its own credentials | In-memory fake |
| Push | Expo (dev build) | Expo | Expo | Fake |
| Mobile build | EAS `development` (dev client) | EAS `staging` (internal distribution) | EAS `production` (stores) | — |
| App identifier | `com.slasheasy.fieldmate.dev` | `com.slasheasy.fieldmate.staging` | `com.slasheasy.fieldmate` [D] | — |

**API environment variables** (all checked with Zod at startup; the API won't start if one is missing or invalid):
```
APP_ENV=development|staging|production|test
PORT=
DATABASE_URL=
AUTH_SECRET=
CORS_ORIGINS=               # comma-separated, empty = none
FILE_STORAGE_ENDPOINT=      # empty for AWS S3
FILE_STORAGE_REGION=
FILE_STORAGE_BUCKET=
FILE_STORAGE_ACCESS_KEY_ID=
FILE_STORAGE_SECRET_ACCESS_KEY=
FILE_STORAGE_FORCE_PATH_STYLE=   # true for MinIO
PUSH_NOTIFICATION_EXPO_ACCESS_TOKEN=   # optional, enables Expo push security
LOG_LEVEL=
```

**Mobile variables** (only public values, set per EAS profile in `eas.json`):
```
APP_ENV=development|staging|production
EXPO_PUBLIC_API_BASE_URL=     # dev emulator: http://10.0.2.2:3000/api/v1
```

**Safeguards against mixing environments** [C]:
1. There's a separate database, bucket, secret and credentials for each environment; no configuration value is shared.
2. JWT `aud` includes `APP_ENV`, so tokens don't work across environments.
3. `db:seed` and destructive test helpers refuse to run when `APP_ENV ∈ {staging, production}`.
4. In `staging` and `production`, the API won't start if `AUTH_SECRET` is shorter than 32 bytes, or if `DATABASE_URL` or `FILE_STORAGE_ENDPOINT` points at `localhost`.
5. Mobile builds have the API URL baked in per EAS profile, and each environment has its own app identifier, so dev, staging and production apps can be installed side by side without mixing up.
6. Only `.env.example` files are committed. `.env*` is in `.gitignore`.

---

## 11. Security architecture

| Area | Measure |
|---|---|
| Passwords | Argon2id with library defaults; no maximum-length surprises (limit 1–128 characters) |
| Tokens | HS256, strong secret, 7-day expiry, iss/aud checked, stored in SecureStore |
| Transport | HTTPS is handled by the host in staging and production; `app.set('trust proxy', 1)` behind the proxy; Android release builds don't allow plain HTTP (only the dev profile allows `10.0.2.2`) |
| Headers | `helmet` defaults; `x-powered-by` turned off |
| CORS | Allow-list from env; empty by default (native apps don't send an Origin header) |
| Input | Zod on every body, query and path parameter; UUIDs checked; request size limits |
| Authorization | Three layers (§8); workers get 404 for tasks they can't see |
| Files | Type checked from the file's bytes, size limit, server-generated keys, private bucket, short-lived presigned URLs |
| Abuse | Rate limit on login |
| Errors | Generic 500 responses; no stack traces or SQL in responses |
| Logging | pino with a request ID; hides `authorization`, `password`, `token` and `FILE_STORAGE_*` |
| Secrets | Only in environment variables or the host's secret manager; never in the mobile bundle; `.env` in gitignore |
| Dependencies | Lockfile committed; `npm audit` run in Phase 6H |
| Database | The API uses a database user that isn't a superuser in staging and production |

---

## 12. Testing architecture

| Suite | Location | Runs against |
|---|---|---|
| Shared unit | `packages/shared/src/**/*.test.ts` | Pure functions: transitions, schemas |
| API unit | `apps/api/src/**/*.test.ts` | Policies, services with fakes, utilities (jwt, password) |
| API integration | `apps/api/test/**/*.int.test.ts` | `createApp()` + supertest + Docker `fieldmate_test` (migrated; tables emptied between tests) + fake storage and push |
| Mobile | `apps/mobile/src/**/*.test.tsx` | jest-expo + RNTL; API functions, camera, location and notification modules mocked |
| E2E | `apps/mobile/e2e/*.yaml` | Maestro, Android emulator, dev build, local API with `db:seed` |

Every important feature is tested for the happy path, validation failure, unauthorized access, an edge case (e.g. an invalid transition or a race) and server failure [C].

---

## 13. Project structure (additions to the original tree in **bold**)

```
fieldmate/
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── (auth)/login.tsx
│   │   │   ├── (manager)/_layout.tsx, index.tsx, tasks/index.tsx, tasks/new.tsx, tasks/[taskId]/index.tsx, tasks/[taskId]/edit.tsx
│   │   │   └── (worker)/_layout.tsx, index.tsx, tasks/index.tsx, tasks/[taskId]/index.tsx, tasks/[taskId]/evidence.tsx, tasks/[taskId]/complete.tsx
│   │   ├── src/ components/ features/{auth,tasks,assignments,evidence,notes,location,notifications}/ hooks/ services/ lib/ types/ constants/ utils/
│   │   ├── **e2e/**                       Maestro flows
│   │   ├── assets/
│   │   ├── **app.config.ts**              (dynamic config per APP_ENV; replaces static app.json)
│   │   ├── eas.json, package.json, tsconfig.json, **jest.config.js**
│   └── api/
│       ├── src/ config/ modules/{auth,users,tasks,assignments,evidence,notes}/ middleware/ db/ services/{storage,push}/ utils/ types/ app.ts server.ts
│       ├── **drizzle/**                   generated SQL migrations
│       ├── **scripts/**                   user-create.ts, seed.ts
│       ├── **test/**                      integration tests + helpers
│       ├── **Dockerfile**, **drizzle.config.ts**, **.env.example**, **jest.config.js**
│       └── package.json, tsconfig.json
├── packages/
│   └── shared/src/ {enums, schemas, task-transitions, errors, dto}.ts  + package.json, tsconfig.json
├── docs/  02-product-specification.md, 03-architecture.md, …
├── **docker-compose.yml**                postgres (dev + test DBs), minio, minio-init
├── **tsconfig.base.json**, **.editorconfig**, **.prettierrc**, **eslint.config.js**
├── package.json (workspaces), README.md, .gitignore
```

About `app.config.ts`: the original tree lists `app.json`. A dynamic config is the standard Expo way to change the app identifier and API URL per environment [T].

---

## 13a. Implementation notes from Phase 6A (version-driven, no behaviour change)

| Topic | Architecture said | Implemented | Why |
|---|---|---|---|
| TypeScript | latest stable | **~6.0** | TS 7.0 is the latest, but Expo SDK 57's template pins ~6.0 and ts-jest supports <7 |
| API module format | not specified | **Native ESM** (`"type": "module"`), Jest in ESM mode | `jose` and `expo-server-sdk` are now ESM-only |
| File type sniffing | `file-type` | **Magic-byte check in our own code** (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`), built in 6E | Only two formats are allowed, so a few lines replace a dependency |
| Env file loading | not specified | Node's built-in `--env-file-if-exists` | No `dotenv` dependency |
| Mobile config | `app.config.ts` | As planned; static `app.json` removed | — |
| React duplicates | — | Root `overrides` pin react 19.2.3, react-native 0.86.3, reanimated 4.5.1, worklets 0.10.1 | npm auto-installed newer peer copies; Expo doesn't support duplicate React in a monorepo |
| Mobile test location | — | `src/**` only | Every file in `app/` is treated as a route by Expo Router |
| RNTL 14 | — | `await render(...)` | `render` is async in RNTL 14 |
| Local init scripts | — | `infra/postgres/init/` creates `fieldmate_test` | Separate test database |
| MinIO image | MinIO | **`quay.io/minio/minio` and `quay.io/minio/mc`, pinned by digest** (RELEASE.2025-09-07T16-13-09Z) | MinIO no longer publishes community images to Docker Hub; quay.io is MinIO's own registry, so the storage technology is unchanged (verified in 6C) |
| `argon2` install script | — | Kept `argon2`; npm 11 blocks its install script, but its prebuilt binary loads at runtime (verified in 6B) | No change needed; re-check when the Docker image is built in 6H |
| Integration tests | — | Run serially (`--runInBand`); `npm test` in the API runs unit then integration | They share one test database and truncate between cases; Jest ignores `maxWorkers` in a project config |
| Mobile tests | RNTL | `await render(...)` and `userEvent` for every interaction | RNTL 14 renders asynchronously; synchronous `fireEvent` left act scopes open and broke later renders in the same file |
| Drizzle migration journal | — | `db:reset` drops the `drizzle` schema as well as `public` | Drizzle records applied migrations in its own schema; dropping only `public` left the database empty but "migrated" |
| Image type check | `file-type` | Own two-signature check (`detectImageType`), built in 6E | Only JPEG and PNG are allowed, so a few lines replace a dependency |
| Photo compression | `expo-image-manipulator` | SDK 57's contextual API (`ImageManipulator.manipulate(...).renderAsync()`); file size read with `expo-file-system`'s `File` | The older `manipulateAsync` is deprecated in SDK 57 |
| Upload progress | XMLHttpRequest | As planned: `fetch` cannot report upload progress in React Native | — |

## 14. Resolved questions (approved 2026-09-16)

| # | Question | Decision |
|---|---|---|
| Q1 | Token revocation | **Add `users.token_version`** (integer, default 0) and a `ver` JWT claim. Logout calls `POST /auth/logout`, which increments it, so every session for that user ends. A CLI `user:revoke-sessions` does the same. |
| Q2 | App identifiers | **`com.slasheasy.fieldmate`** (+ `.dev`, `.staging`) |
| Q3 | Development demo accounts | **Yes.** `db:seed` creates 1 manager and 2 workers; it refuses to run in staging or production. |
| Q4 | `GET /health` | **Yes.** Unauthenticated, returns `{status:"ok"}` only. |

Q1 adds `users.token_version` and `POST /api/v1/auth/logout` to the Phase 5 schema and API.
