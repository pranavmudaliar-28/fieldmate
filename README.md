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

```sh
npm install                 # installs all workspaces
npm run build:shared        # builds packages/shared (the API and app import its output)

# Local services (PostgreSQL + MinIO)
docker compose up -d

# API
cp apps/api/.env.example apps/api/.env   # then set AUTH_SECRET
npm run db:migrate -w @fieldmate/api     # create the schema
npm run db:seed -w @fieldmate/api        # development demo accounts
npm run dev -w @fieldmate/api            # http://localhost:3000/health

# Mobile
cp apps/mobile/.env.example apps/mobile/.env
npm run start -w @fieldmate/mobile
```

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
