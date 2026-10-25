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

- `DATABASE_URL` in `backend/.env` (or repo-root `.env.local`). Postgres must accept TLS. Schema is updated on boot (`synchronize: true`).
- Redis at `REDIS_HOST`:`REDIS_PORT` (default `localhost:6379`) before boot.
- `OPENROUTER_API_KEY` before a queued job or a follow-up message can succeed.
- SMTP at `localhost:1025` while `EMAIL_VERIFICATION_REQUIRED` is true. Set it to `false` to skip email codes.

`backend/.env` overrides the same keys in repo-root `.env.local`.

## Modules

`src/main.ts` enables CORS for `http://localhost:5173` and a global validation pipe that rejects unknown body fields.

`src/app.module.ts` loads config, then `DatabaseModule`, `AiModule`, `AuthModule`, `ConversationModule`, `QueueModule`, `ProducerModule`, and `ConsumerModule`.

Relative imports use a `.js` extension. Register any new TypeORM entity on the `entities` array in `src/database/database.module.ts`.
