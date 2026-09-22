# FieldMate

A native mobile app for managing field tasks. Managers create tasks and assign each one to a field worker. The worker starts the task, captures photos, adds notes and completes it.

| Path              | What                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `apps/mobile`     | Expo (SDK 57) + React Native + Expo Router app for iOS and Android   |
| `apps/api`        | Node.js + Express 5 REST API (`/api/v1`)                             |
| `packages/shared` | Types, Zod schemas and task status rules used by both apps           |
| `docs/`           | Product specification, architecture, UI/UX, database & API contracts |
| `infra/`          | Local development service setup (Postgres init scripts)              |

## Prerequisites

- **Node.js 24 LTS** (npm 11)
- **Docker Desktop** with WSL2, for local PostgreSQL and MinIO
- **Android Studio** emulator (Google Play system image) for running the app
- An **Expo account** and the EAS CLI (`npm i -g eas-cli`) for development builds

## Getting started

First time only:

```sh
npm install                              # installs all workspaces

cp apps/api/.env.example apps/api/.env   # then set AUTH_SECRET
cp apps/mobile/.env.example apps/mobile/.env

docker compose up -d                     # PostgreSQL + MinIO
npm run db:migrate -w @fieldmate/api     # create the schema
npm run db:seed -w @fieldmate/api        # development demo accounts
```

## Running the app

```sh
npm run dev
```

That one command points the `.env` files at this machine's LAN address, starts
PostgreSQL and MinIO, then runs the API and the Expo dev server together with
`[api]` and `[app]` prefixed output. Stop both with Ctrl+C.

Open **Expo Go** on a phone on the same Wi-Fi and scan the QR code, or enter the
`exp://<your-lan-ip>:8081` address it prints.

| Command           | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Everything: services, API and Expo                      |
| `npm run dev:api` | The API alone, on :3000                                 |
| `npm run dev:app` | The Expo dev server alone, on :8081                     |
| `npm run dev:ip`  | Re-point the `.env` files at this machine's LAN address |

### If the phone loads the app but cannot log in

The phone reaches the API over Wi-Fi, so it needs a real LAN address rather than
`localhost` — and that address changes whenever the machine joins a different
network. `npm run dev` refreshes it on every start; run `npm run dev:ip` on its
own to refresh it without restarting, or pass one explicitly:

```sh
npm run dev:ip -- 10.0.0.5
```

Restart afterwards: `EXPO_PUBLIC_*` values are baked into the bundle, so Metro
has to rebuild before the phone sees the change. Windows may also prompt for a
firewall exception the first time — allow it for **private** networks.

## Quality checks

```sh
npm run typecheck      # builds shared, then type-checks every workspace
npm test               # shared + API + mobile test suites
npm run lint
npm run format:check
```

## Accounts

There is no self-registration. Accounts are created from the command line:

```sh
npm run user:create -w @fieldmate/api -- --email a@b.co --name "Anita Rao" --role MANAGER
npm run user:revoke-sessions -w @fieldmate/api -- --email a@b.co   # e.g. lost phone
```

`npm run db:seed -w @fieldmate/api` creates development-only demo accounts
(`manager@fieldmate.dev`, `worker1@fieldmate.dev`, `worker2@fieldmate.dev`) with the password from
`SEED_PASSWORD` (default `FieldMate-dev-1`). It refuses to run in staging or production.

## Database

```sh
npm run db:generate -w @fieldmate/api   # generate a migration from the Drizzle schema
npm run db:migrate -w @fieldmate/api    # apply migrations (a deploy step, never on API startup)
npm run db:reset -w @fieldmate/api      # drop and recreate (development and test only)
```

## Environments

|             | API config                              | Mobile build                                              |
| ----------- | --------------------------------------- | --------------------------------------------------------- |
| development | `apps/api/.env` (local Docker services) | EAS profile `development` → `com.slasheasy.fieldmate.dev` |
| staging     | Host secret manager                     | EAS profile `staging` → `com.slasheasy.fieldmate.staging` |
| production  | Host secret manager                     | EAS profile `production` → `com.slasheasy.fieldmate`      |

Never commit `.env` files or secrets. Only the `.env.example` files are committed. In staging and production the API refuses to start if its database or storage points at a local host.
