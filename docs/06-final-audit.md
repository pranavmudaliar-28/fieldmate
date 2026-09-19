# FieldMate — Phase 6H: Final Audit

Date: 2026-09-19
Scope: the checklist from the original specification (§34), each item checked against the code that exists, not against intentions.

**Result: every checklist item passes.** Three things remain outside our control (an Expo account, Android tooling, and a hosting choice); they are listed in §4.

---

## 1. Checklist

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Requirements | ✅ | Every confirmed requirement from Phase 1 is built; the 30 open questions were answered by the product owner and recorded in `docs/02` §11 (D-01…D-20) and `docs/03` §14 (Q1–Q4). |
| 2 | Features | ✅ | F-001…F-009 all implemented. Nothing beyond them. |
| 3 | Roles | ✅ | Exactly two: `MANAGER`, `FIELD_WORKER` (database enum, shared constants). |
| 4 | Permissions | ✅ | Three layers: route role check, task visibility, action rules. 20 policy unit tests plus integration tests for every role/status combination. A worker asking for another worker's task gets "not found", never "forbidden". |
| 5 | User flows | ✅ | Manager and worker flows run end to end against real services (§2). |
| 6 | Screens | ✅ | S-001…S-010, no more. Edit reuses S-004; `_layout` files and the entry redirect are navigation, not screens. |
| 7 | Navigation | ✅ | Role-guarded route groups; a signed-out user lands on Login; the wrong role is redirected; a 401 signs the user out. |
| 8 | Database | ✅ | 7 tables, 15 CHECK constraints, 13 indexes; matches `docs/05` §2 exactly, with no extra columns (verified against the migration). |
| 9 | API | ✅ | 19 endpoints, all documented, all present (§2). No registration, password reset, admin or metrics routes. |
| 10 | Authentication | ✅ | Argon2id passwords, JWT with per-user revocation, 7-day expiry, environment-scoped audience, equal-time failures, rate-limited login. |
| 11 | Authorization | ✅ | Enforced on the server for every endpoint; the app's own checks are convenience only. |
| 12 | Validation | ✅ | Shared Zod schemas on both sides, unknown fields rejected, UUIDs checked, file type detected from the file's own bytes, plus database constraints. |
| 13 | Error handling | ✅ | One error shape everywhere; unexpected errors become a generic 500 with no internals. Verified that a database error message never reaches the client. |
| 14 | Security | ✅ | See §3. |
| 15 | Environment separation | ✅ | Separate database, bucket, secret and app identifier per environment; a token from one environment is rejected by another; staging and production refuse local hosts; seed and reset refuse to run outside development and test. |
| 16 | File handling | ✅ | Private bucket, server-generated keys, 10 MB limit, JPEG/PNG only by content, short-lived links, orphan cleanup on failure, EXIF removed on the device. |
| 17 | Notifications | ✅ | Exactly the three approved triggers; failures never fail the action; uninstalled devices cleaned up automatically. |
| 18 | Native capabilities | ✅ | Camera, location and notifications, each with permission handling and a working fallback. Only the camera and location permissions are declared. |
| 19 | Testing | ✅ | 431 automated tests; 94% of API lines and 82% of mobile lines covered; two end-to-end flows written (not yet run — §4). |
| 20 | Performance | ✅ | Task lists are paged with a keyset cursor; task details take a fixed 4 queries regardless of photo or note count; lists are virtualised; photos are compressed before upload. |
| 21 | Project structure | ✅ | Matches the specified layout, plus `infra/` (local Postgres init) and `e2e/` (flows). |
| 22 | No unauthorised features | ✅ | No chat, payments, analytics, reports, exports or admin screens. |
| 23 | No unnecessary APIs | ✅ | Every endpoint traces to a confirmed feature; the 9 added beyond the original list were each approved (Phases 1, 3, 5). |
| 24 | No unnecessary database fields | ✅ | Column-by-column comparison with `docs/05` §2: identical. |
| 25 | No secrets committed | ✅ | Only `.env.example` files are tracked; no keys, certificates or credentials; no secret-shaped strings in source. |
| 26 | No unresolved behaviour implemented silently | ✅ | Every behavioural decision was asked and answered before it was built; deviations are recorded in `docs/03` §13a. |

---

## 2. What was actually exercised

**Live, against PostgreSQL 18 and MinIO in Docker:**
- The critical flow: create and assign → worker starts → photo uploaded → note added → completed → manager reviews → **photo downloaded from storage byte-identical to the upload** → reopened, keeping its photo.
- Manager flow: worker list, create, filter, edit, complete refused without a photo, cancel, and cancelling twice refused.
- Auth: login, `/users/me`, wrong password, logout, and reuse of a token after logout refused.
- Push: device registered, a real call to the Expo push service, the invalid token removed automatically, and tokens cleared on logout.
- Endpoint audit: all 19 documented endpoints answer; unauthenticated requests get 401; unknown paths get 404.
- The production container: builds, runs as a non-root user, serves the API, and refuses to start with a local database or a short secret.

**Automated:** 431 tests (shared 40, API unit 88, API integration 168, mobile 135), plus typecheck, ESLint and Prettier.

---

## 3. Security review

| Area | State |
|---|---|
| Passwords | Argon2id, random salt per password, never logged or returned. |
| Sessions | Signed tokens; role and revocation checked from the database on every request; stored in the device keychain only. |
| Brute force | Login limited to 10 attempts per 15 minutes per IP and email. |
| Account enumeration | An unknown email and a wrong password are indistinguishable, in both message and timing. |
| Data exposure | Workers can only see their own current task; storage keys and password hashes never leave the server; task responses omit anything no screen shows. |
| Uploads | Size limit before anything is read, type from file content, server-generated names, private bucket, 15-minute links. |
| Transport and headers | Helmet, framework header off, CORS closed by default, 100 KB body limit, HTTPS at the host with proxy trust in staging and production. |
| Logging | Request IDs, with authorization headers, passwords, tokens and storage keys redacted; verified no credential appeared in any live run. |
| Secrets | Environment variables only; nothing in the mobile bundle beyond the public API URL. |
| Dependencies | 17 moderate advisories, **all in development tooling** (Expo CLI, drizzle-kit/esbuild). None in the API's production tree. The only offered "fixes" are downgrades that would break the project, so they are not applied. One (`decode-uri-component`) is a stale match: the installed 0.2.2 already contains the fix. |

---

## 4. Outside our control

| # | Item | Needed for |
|---|---|---|
| 1 | **Expo account** (`eas login`, `eas init`, `eas build`) | The first mobile build; it also supplies the project id that push tokens need. |
| 2 | **Firebase project** (FCM credentials via `eas credentials`) | Android push delivery. |
| 3 | **Android Studio or a phone**, plus **Maestro** | Running the two end-to-end flows and the camera on a real device. |
| 4 | **Apple Developer account** | iOS builds and push. |
| 5 | **Hosting choice** (container host, managed Postgres, S3-compatible bucket) | Deploying staging and production. The API is host-agnostic and ready; backups and a deploy pipeline get set up with the chosen host. |

Nothing above blocks the code: it is complete, tested and verified locally.

---

## 5. Known limitations (by design, all approved)

- No offline queue: the app detects the network and refuses actions rather than storing them.
- Logout ends sessions on every device, because revocation is per user.
- Notifications are in-process, with no retry queue or delivery receipts.
- The rate limit is per API instance, since it is held in memory.
- English only; light theme; portrait only.
