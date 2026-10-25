# Backend

NestJS 12 API and BullMQ worker for this repo. Package name: `producer`. ESM TypeScript (`nodenext`). The repo-wide runbook is [../README.md](../README.md). Agent-specific constraints are in [../AGENTS.md](../AGENTS.md).

## Commands

Run these in `backend/`, with Node.js 20.12 or newer.

```powershell
Copy-Item .env.example .env
npm install
npm run start:dev
```

| Script | What it does |
| --- | --- |
| `npm run start:dev` | `nest start --watch` on `PORT` (default 3000). |
| `npm run start` | One-shot dev start, no watch. |
| `npm run build` | Compile to `dist/`. |
| `npm run start:prod` | `node dist/main`. Build first. |
| `npm test` | Vitest `*.spec.ts`. No Redis, Postgres, or API key. |
| `npm run test:e2e` | Vitest `*.e2e-spec.ts`. Needs `DATABASE_URL` and Redis. The OpenRouter spec also needs `OPENROUTER_API_KEY` or it skips. |
| `npm run lint` | oxlint on `src/` and `test/`. |

## Required services

- `DATABASE_URL` in `backend/.env` (or repo-root `.env.local`). Postgres must accept TLS. Development synchronizes the schema on boot; production (`NODE_ENV=production`) runs the committed migrations instead.
- Redis at `REDIS_HOST`:`REDIS_PORT` (default `localhost:6379`) before boot.
- `OPENROUTER_API_KEY` before a queued comment can succeed. Ask uses the provider stored on the conversation.
- SMTP at `localhost:1025` (default) to send invitations.

`backend/.env` overrides the same keys in repo-root `.env.local`. A variable already in the process environment beats both.

## Modules

`src/main.ts` rejects any request whose `Origin` is not `WEB_ORIGIN`, enables credentialed CORS for that origin, and installs a global validation pipe that rejects unknown body fields. Production refuses to start until `WEB_ORIGIN`, a non-default `JWT_SECRET`, `DATABASE_URL`, `REDIS_HOST`, and the provider key are set.

`src/app.module.ts` loads config, then `DatabaseModule`, `AiModule`, `AuditModule`, `AuthModule` (roles, session cookie, optional company login), `UsersModule`, `SettingsModule`, `ConversationModule`, `QueueModule`, `BatchModule`, `ConnectionsModule`, `RetentionModule`, `ProducerModule` (read-only queue inspection), and `ConsumerModule`.

Relative imports use a `.js` extension. Register any new TypeORM entity in `ENTITIES` and any new migration in `MIGRATIONS` in `src/database/database.module.ts`.

The HTTP surface is listed in [../README.md](../README.md). The operator SOP is [../docs/operations.md](../docs/operations.md).