# Agent guide

Use this file to install, run, and change this repo. The human overview is [README.md](README.md). Commands below assume the working directory shown. On PowerShell, `cd backend` then run the npm script. Do not run backend or frontend scripts from the repo root.

## Run the stack

Prerequisites: Node.js 20.12 or newer, a TLS Postgres URL, and Redis. Nest requires Node 20. `process.loadEnvFile` requires 20.12. The repo does not start Redis or Postgres.

```powershell
cd backend
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm install
npm run start:dev
```

Bash equivalent of the copy: `cp .env.example .env`.

Put a real `DATABASE_URL` in `backend/.env` before the second start. In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/login`. API base URL is `http://localhost:3000`.

Confirm boot:

```powershell
Invoke-RestMethod http://localhost:3000/
Invoke-RestMethod http://localhost:3000/queue/status
Invoke-RestMethod http://localhost:3000/auth/config
```

`/` must return `Hello World!`. A Redis failure surfaces on `/queue/status` or during boot, not on `/`.

For a local account without Mailpit, set `EMAIL_VERIFICATION_REQUIRED=false` in `backend/.env` and restart the API. `POST /auth/register` then returns `accessToken`. With the default `true`, registration returns `{ email, verificationRequired: true }` and the 6-digit code is emailed to `SMTP_HOST:SMTP_PORT` (`localhost:1025`).

## Env

Copy `backend/.env.example` to `backend/.env`. Never commit `.env`, `.env.local`, or key values.

Load order inside `AppModule`: `backend/.env`, then repo-root `.env.local`. The earlier file wins. `database.config.ts` also reads `backend/.env`, repo-root `.env`, and repo-root `.env.local` at import time through `process.loadEnvFile`, which does not override variables already set in the shell. `neon deploy` writes the pooled `DATABASE_URL` to repo-root `.env.local`.

| Variable | Required to boot | Role |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres URL. TypeORM uses `ssl: true`, `synchronize: true`, pool max 10. |
| `PORT` | No | HTTP port. Default `3000`. |
| `JOB_QUEUE_NAME` | No | BullMQ queue. Default `jobs`. |
| `REDIS_HOST` | No | Default `localhost`. |
| `REDIS_PORT` | No | Default `6379`. Must be numeric. |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | No | Omitted from the ioredis options when blank. |
| `REDIS_TLS` | No | `true`, `1`, or `yes` enables TLS. |
| `JWT_SECRET` | No | Default `dev-jwt-secret`. Changing it invalidates existing tokens and outstanding verification-code hashes. |
| `JWT_EXPIRES_IN` | No | Default `1d`. |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | When email verification is on | Defaults `localhost`, `1025`, `noreply@localhost`. `secure` is false. |
| `EMAIL_VERIFICATION_REQUIRED` | No | Default `true`. Accepted: `true`, `false`, `1`, `0`, `yes`, `no`. |
| `OPENROUTER_API_KEY` | To process jobs and chat | Worker always calls provider `openrouter`. |
| `OPENROUTER_BASE_URL` | No | Default `https://openrouter.ai/api/v1`. |
| `AI_DEFAULT_PROVIDER` | No | One of `openai`, `anthropic`, `gemini`, `openai-compatible`, `openrouter`. Job processing ignores this and passes `openrouter`. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_COMPATIBLE_*` | No | Used only when code calls `AiService` with that provider. |

Frontend: `frontend/.env.example` contains `VITE_API_BASE_URL=http://localhost:3000`. Vite inlines `VITE_*` at dev-server start. Restart `npm run dev` after edits. CORS in `backend/src/main.ts` allows only `http://localhost:5173`. Keep the Vite port on 5173 unless you change that origin too.

## HTTP surface

Global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`. Extra JSON properties return 400.

| Method and path | Auth | Behavior |
| --- | --- | --- |
| `GET /` | No | `Hello World!` |
| `GET /queue/status` | No | Counts for the configured queue. |
| `GET /auth/config` | No | `{ emailVerificationRequired }`. |
| `POST /auth/register` | No | `{ email, password }`. Password min length 8. |
| `POST /auth/register/verify` | No | `{ email, code }` where `code` is 6 digits. Returns `{ accessToken }`. |
| `POST /auth/login` | No | `{ email, password }`. Returns `{ accessToken }`. 403 if the email is unverified. |
| `GET /auth/me` | Bearer | Profile for the token `sub`. |
| `GET /producer/models` | Bearer | Free OpenRouter models. Cached 5 minutes. Public catalog fetch, no API key on that GET. |
| `POST /producer` | Bearer | `{ name, description, model }`. Model must be in the free catalog. Enqueues job name `jobs` with `{ name, description, model, userId }`. |
| `GET /producer` | Bearer | One page of jobs for a required `state` (`waiting`, `active`, `completed`, `failed`, `delayed`, `paused`). Query: `offset` default 0, `limit` default 20 max 50. Returns `{ items, total, offset, limit }`. Not scoped to the caller. |
| `GET /producer/:id` | Bearer | One job, or `null`. |
| `PATCH /producer/:id` | Bearer | Update name, description, and/or model. |
| `DELETE /producer/:id` and `DELETE /producer` | Bearer | Remove one job, or all jobs. |
| `GET /consumer` | Bearer | `{ running }`. `running` is false while the worker is paused. |
| `PATCH /consumer` | Bearer | `{ "running": true \| false }` resumes or pauses the in-process worker. |
| `GET /conversations` | Bearer | Conversations for the token user. |
| `GET /conversations/:id` | Bearer | One conversation. UUID. 404 when it belongs to someone else. |
| `POST /conversations/:id/messages` | Bearer | `{ content }`. Calls the conversation's stored provider and model, then appends the user and assistant messages. |

Token header: `Authorization: Bearer <accessToken>`. Frontend storage key: `accessToken`. A 401 clears it.

## How a job becomes a chat

`ConsumerProcessor` (`backend/src/consumer/consumer.processor.ts`) runs in the API process. There is no second worker service.

- If a conversation already exists for the BullMQ job id, the processor returns it and does not call the model again.
- Otherwise it calls `AiService.generateText` with `provider: 'openrouter'` and the job's `model`, then `ConversationService.createInitial`.
- Jobs without `userId` or `model` fail.
- Pause state survives only for the life of the process. A restart comes back running.

`AiService.create(overrides)` builds one adapter. Call-site fields override adapter fields, which override env. Queued work and follow-up messages both go through `generateText`.

## Code map

| Area | Files |
| --- | --- |
| Boot, CORS, validation | `backend/src/main.ts`, `backend/src/app.module.ts` |
| Env | `backend/src/config/*.ts` |
| Schema | `backend/src/database/database.module.ts`. Entities are listed by hand: `User`, `RegistrationCode`, `Conversation`, `ConversationMessage`. Add new entities there. `synchronize: true` is the schema mechanism. |
| Queue | `backend/src/queue/queue.module.ts`, `queue.controller.ts` |
| Enqueue | `backend/src/producer/` |
| Worker | `backend/src/consumer/consumer.processor.ts`, `consumer.service.ts` |
| Transcripts | `backend/src/conversation/` |
| Models | `backend/src/ai/`. Catalog filter is `freeOpenRouterModels` in `openrouter-catalog.ts`. |
| Auth | `backend/src/auth/`. Passwords are hashed. Registration codes are stored as hashes. |
| SPA | `frontend/src/main.tsx` routes, `frontend/src/api.ts` client, `pages/AuthPage.tsx`, `pages/ProducerPage.tsx`, `pages/ConsumersPage.tsx` |

Backend TypeScript is ESM (`"type": "module"`, `module: nodenext`). Relative imports in `backend/src` and `backend/test` use a `.js` suffix, including imports of `.ts` files. `nest start --watch` and Vitest both require that suffix.

`neon.ts` sets `auth: false` and a 7-day TTL for new non-default Neon branches. Do not wire Neon Auth into this app.

## Tests

From `backend/`:

- `npm test` — Vitest, include `**/*.spec.ts` (`vitest.config.ts`). Mocked. Safe without Redis, Postgres, or keys.
- `npm run test:e2e` — include `**/*.e2e-spec.ts`. `test/app.e2e-spec.ts` imports `AppModule` and needs `DATABASE_URL` plus Redis. `test/openrouter.live.e2e-spec.ts` skips itself when `OPENROUTER_API_KEY` is empty; with a key it writes to Postgres and calls OpenRouter.
- `npm run lint` — oxlint, type-aware, on `src/` and `test/`.
- `npm run build` — `nest build` into `backend/dist`. Do not hand-edit `dist/`.

From `frontend/`: `npm run lint`, and `npm run build` (`tsc -b` then `vite build`). No unit tests.

## When something fails

| Symptom | Fix |
| --- | --- |
| `DATABASE_URL is required` | Set it in `backend/.env` or repo-root `.env.local`, then start from `backend/`. |
| Boot or `/queue/status` hangs or throws a Redis error | Start Redis on `6379`, or set `REDIS_*`. |
| `Failed to send registration email` | Run Mailpit on port 1025, or set `EMAIL_VERIFICATION_REQUIRED=false` and restart. |
| `Could not load OpenRouter models` | The API cannot reach `OPENROUTER_BASE_URL/models`. Job create also depends on that list. |
| `Choose a free OpenRouter model` | The id is not in the current free catalog. Load `GET /producer/models` and use one of those ids. |
| Job stays `waiting` | The worker is paused. `GET /consumer` returns `{ "running": false }`. `PATCH /consumer` with `{ "running": true }` resumes it. |
| Job moves to `failed` | The worker threw. A missing `OPENROUTER_API_KEY`, a missing `userId`, or a missing `model` fails that attempt. `failedReason` is on `GET /producer/:id`. |
| Browser calls fail from a non-5173 origin | CORS allows only `http://localhost:5173`. |
| Login works in curl and the SPA still looks logged out | Token must be stored as `accessToken`. The SPA sends it only when `auth` is not `false` in `frontend/src/api.ts`. |
| Schema looks stale or empty | `synchronize: true` applies entity changes on boot to whatever `DATABASE_URL` points at. Use a dev database. |

Do not add a root `start` script, a Docker Compose file, or a second worker package unless the task asks for that. The worker is `ConsumerProcessor` inside the API.
