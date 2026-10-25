# nest-bull-poc

A NestJS API and React console for a BullMQ job queue. Authenticated users enqueue a job with a free OpenRouter model. A worker in the same API process calls that model, stores the transcript in Postgres, and the console can continue the conversation.

## Layout

This is not an npm workspace. Each app has its own lockfile and `node_modules`.

| Path | What it is |
| --- | --- |
| `backend/` | NestJS 12 API, BullMQ worker, TypeORM, auth, and the AI client. Package name is `producer`. |
| `frontend/` | Vite + React 19 console. Talks to the API at `http://localhost:3000`. |
| `neon.ts` | Neon branch config only. App auth is the backend's own JWT, not Neon Auth. |
| Root `package.json` | `@neon/config` and `@neon/env` only. It has no `start` script. |

Install and run commands from `backend/` and `frontend/`. Installing only at the repo root does not install the app.

## What must be running

The API process exits or rejects requests when any of these are missing.

1. **Node.js 20.12 or newer.** Nest requires Node 20. Config loading uses `process.loadEnvFile`, which landed in 20.12.
2. **Postgres with TLS**, via `DATABASE_URL`. TypeORM connects with `ssl: true` and `synchronize: true`, so the URL must be a dev database. Boot creates and updates tables. Neon Lakebase is the intended host. `neon deploy` writes the pooled URL to repo-root `.env.local`.
3. **Redis** for BullMQ. Defaults are `localhost:6379`, no password, queue name `jobs`. Nothing in this repo starts Redis.
4. **OpenRouter** for the model picker and for job processing. `GET /producer/models` calls `https://openrouter.ai/api/v1/models` and keeps models whose prompt and completion prices are `0`. Creating or running a job needs `OPENROUTER_API_KEY`.
5. **SMTP on `localhost:1025`** when `EMAIL_VERIFICATION_REQUIRED` is true (the default). [Mailpit](https://github.com/axllent/mailpit) uses that port. Set `EMAIL_VERIFICATION_REQUIRED=false` to register without mail.

## Setup

From `backend/`:

```powershell
Copy-Item .env.example .env
npm install
```

In bash, copy the example with `cp .env.example .env`.

Edit `backend/.env` before starting:

- `DATABASE_URL` — required. A Postgres URL that accepts TLS.
- `OPENROUTER_API_KEY` — required to process jobs and to continue a chat.
- `EMAIL_VERIFICATION_REQUIRED=false` — optional, skips the 6-digit email code.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS` — only when Redis is not local and open.

Env files, in the order the API loads them: `backend/.env`, then repo-root `.env.local`. The first file wins when a key is set in both. Start the API with `backend/` as the working directory so the relative `.env` load matches that.

From `frontend/`:

```powershell
npm install
```

`frontend/.env` is optional. `VITE_API_BASE_URL` defaults to `http://localhost:3000`. Restart Vite after changing it. The API allows CORS only from `http://localhost:5173`.

## Run

Use two terminals. Redis and Postgres must already be reachable.

```powershell
cd backend
npm run start:dev
```

```powershell
cd frontend
npm run dev
```

- API: `http://localhost:3000` (`PORT` overrides the port)
- Console: `http://localhost:5173`
- Sign-in: `http://localhost:5173/login`

Production API build, still from `backend/`:

```powershell
npm run build
npm run start:prod
```

## Check that it booted

```powershell
Invoke-RestMethod http://localhost:3000/
Invoke-RestMethod http://localhost:3000/queue/status
Invoke-RestMethod http://localhost:3000/auth/config
```

`/` returns `Hello World!`. `/queue/status` returns job counts and proves Redis is connected. `/auth/config` returns `{ "emailVerificationRequired": true }` or `false`.

## Request path

1. `POST /auth/register` with `{ "email", "password" }`. Password length is at least 8.
2. When verification is on, read the 6-digit code from Mailpit and `POST /auth/register/verify` with `{ "email", "code" }`. The code expires in 10 minutes, allows 5 attempts, and cannot be resent for 60 seconds.
3. When verification is off, register returns `accessToken` directly. Otherwise `POST /auth/login` returns it.
4. Send `Authorization: Bearer <accessToken>` on `/producer`, `/consumer`, `/conversations`, and `/auth/me`. The SPA stores the token in `localStorage` under `accessToken`.
5. `GET /producer/models`, pick an id, then `POST /producer` with `{ "name", "description", "model" }`. That enqueues a BullMQ job named `jobs`.
6. The worker calls OpenRouter with that model, then writes a conversation. `PATCH /consumer` with `{ "running": false }` pauses the worker.
7. `GET /conversations` and `POST /conversations/:id/messages` with `{ "content" }` continue the same model.

`/queue/status` does not require a token. The global validation pipe strips unknown fields and rejects them with 400.

## Tests and lint

From `backend/`:

```powershell
npm test
npm run test:e2e
npm run lint
```

`npm test` runs `*.spec.ts`. Those specs mock the queue, the database, and the model client. They do not need Redis, Postgres, or an API key.

`npm run test:e2e` runs `*.e2e-spec.ts`. `test/app.e2e-spec.ts` boots the real `AppModule`, so `DATABASE_URL` and Redis must be up. `test/openrouter.live.e2e-spec.ts` is skipped unless `OPENROUTER_API_KEY` is set, and then it calls OpenRouter and Postgres.

From `frontend/`:

```powershell
npm run lint
npm run build
```

The frontend has no test script.

## More detail

[AGENTS.md](AGENTS.md) is the operating guide for coding agents: env precedence, module map, and the failures that look like application bugs. Package notes are in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
