# Agent guide

Use this file to install, run, and change this repo. The human overview is [README.md](README.md). The operator SOP is [docs/operations.md](docs/operations.md). Commands below assume the working directory shown. On PowerShell, `cd backend` then run the npm script. Do not run backend or frontend scripts from the repo root.

The product is a feedback coding desk for one company on its own server. A reviewer creates a batch of comments, the in-process worker tags each comment through the company's model endpoint, and the reviewer corrects tags and exports a CSV. One installation is one company. Do not add tenants, analytics, or any call to a service this repo's authors run.

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

Open `http://localhost:5173/login`. The API listens on `http://localhost:3000`. The browser never calls it directly: Vite proxies `/api/*` to it and strips the `/api` prefix, so the SPA calls `/api/auth/login` and Nest serves `/auth/login`.

Confirm boot:

```powershell
Invoke-RestMethod http://localhost:3000/
Invoke-RestMethod http://localhost:3000/queue/status
Invoke-RestMethod http://localhost:3000/auth/config
```

`/` must return `Hello World!`. A Redis failure surfaces on `/queue/status` or during boot, not on `/`.

Getting an account. Public registration is closed. The first admin comes from `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`, and only when the user table is empty. A dev database that already has users never bootstraps; set a role there directly or use a fresh database. Further people come from an admin invite (`POST /users/invites`, link `/invite?token=...`, mailed to `SMTP_HOST:SMTP_PORT`). For a throwaway local account set `ALLOW_PUBLIC_REGISTER=true` (ignored when `NODE_ENV=production`); with `EMAIL_VERIFICATION_REQUIRED=true` that registration mails a 6-digit code, so also set it to `false` when you have no Mailpit.

## Env

Copy `backend/.env.example` to `backend/.env`. Never commit `.env`, `.env.local`, or key values. Never print secret values from `backend/.env`.

Load order inside `AppModule`: `backend/.env`, then repo-root `.env.local`. The earlier file wins. A variable already in the process environment beats both. `database.config.ts` also reads `backend/.env`, repo-root `.env`, and repo-root `.env.local` at import time through `process.loadEnvFile`, which does not override variables already set in the shell. `neon deploy` writes the pooled `DATABASE_URL` to repo-root `.env.local`.

| Variable | Required to boot | Role |
| --- | --- | --- |
| `NODE_ENV` | No | `production` turns on the boot guards below, disables `synchronize`, runs migrations, and marks the session cookie `Secure`. |
| `WEB_ORIGIN` | Production only | The one allowed browser origin. Dev default `http://localhost:5173`. Also the base of invite links and the OIDC redirect URI. |
| `DATABASE_URL` | Yes | Postgres URL. TypeORM uses `ssl: true` and pool max 10. `synchronize: true` in development only. |
| `PORT` | No | HTTP port. Default `3000`. |
| `JOB_QUEUE_NAME` | No | BullMQ queue. Default `jobs`. |
| `REDIS_HOST` | No in dev, yes in production | Default `localhost` in dev. |
| `REDIS_PORT` | No | Default `6379`. Must be numeric. |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | No | Omitted from the ioredis options when blank. |
| `REDIS_TLS` | No | `true`, `1`, or `yes` enables TLS. |
| `MODEL_REQUESTS_PER_MINUTE` | No | Worker rate limit. Default `20`. Concurrency stays 1. |
| `JWT_SECRET` | No in dev, yes in production | Default `dev-jwt-secret` is refused in production. Changing it invalidates every session and outstanding registration-code hash. |
| `JWT_EXPIRES_IN` | No | Default `1d`. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | No | Create the first admin on an empty user table. Remove after first sign-in. |
| `ALLOW_PUBLIC_REGISTER` | No | `true` opens `POST /auth/register`. Ignored in production. |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | For invites | Defaults `localhost`, `1025`, `noreply@localhost`. `secure` is false, no credentials. |
| `EMAIL_VERIFICATION_REQUIRED` | No | Default `true`. Affects public registration and login of unverified users. Accepted: `true`, `false`, `1`, `0`, `yes`, `no`. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | No | All three set enables company login. Redirect URI is `${WEB_ORIGIN}/api/auth/oidc/callback`. |
| `AI_DEFAULT_PROVIDER` | Production | One of `openai`, `anthropic`, `gemini`, `openai-compatible`, `openrouter`. Ask uses the provider stored on the conversation. Batch coding and the model Test use OpenRouter. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_COMPATIBLE_*` and each provider's `*_MODEL` and `*_BASE_URL` | `OPENROUTER_API_KEY` for batches | Reviewers pick a free OpenRouter model. `OPENROUTER_MODEL` is the suggested default only when that id is on the free list. |

Production boot guards (`backend/src/config/app.config.ts`): with `NODE_ENV=production` the API refuses to start unless `WEB_ORIGIN`, a non-default `JWT_SECRET`, `DATABASE_URL`, `REDIS_HOST`, and the key for `AI_DEFAULT_PROVIDER` are set. For `openai-compatible` the base URL stands in for the key. Migrations in `backend/src/database/migrations/` run on boot in production. Register new migrations in `MIGRATIONS` in `database.module.ts`.

Frontend: `frontend/.env.example` documents an optional `VITE_API_BASE_URL`. Leave it unset so the SPA calls same-origin `/api`. Vite inlines `VITE_*` at dev-server start, so restart `npm run dev` after edits. CORS and the origin check in the API allow only `WEB_ORIGIN`. Keep the Vite port on 5173 unless you change `WEB_ORIGIN` too.

## Session

Sign-in sets an `httpOnly` cookie named `session` (`SameSite=Lax`, `Secure` in production). The browser sends it through the proxy. Do not put a token in `localStorage` or `sessionStorage`. `AuthGuard` also accepts `Authorization: Bearer <accessToken>` for scripts. The guard loads the user on every request and rejects a missing or disabled user or a stale session version, so disabling a person ends their access on the next request. The SPA clears its state and goes to `/login` on a 401. `POST /auth/logout` clears the cookie.

## HTTP surface

Global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`. Extra JSON properties return 400. "Admin" is `AdminGuard`: a signed-in user with role `admin`, else 403.

| Method and path | Auth | Behavior |
| --- | --- | --- |
| `GET /` | No | `Hello World!` |
| `GET /queue/status` | No | Counts for the configured queue. |
| `GET /auth/config` | No | `{ emailVerificationRequired, publicRegistration, companyLogin }`. |
| `POST /auth/register`, `POST /auth/register/verify` | No | 403 unless public registration is on. Register takes `{ email, password }` (min 8). Verify takes `{ email, code }`. |
| `POST /auth/login` | No | `{ email, password }`. Sets the `session` cookie and returns `{ accessToken }`. 403 if unverified or disabled. |
| `POST /auth/logout` | No | 204. Clears the cookie. |
| `GET /auth/oidc/start`, `GET /auth/oidc/callback` | No | Company login. Full-page redirects that end at `${WEB_ORIGIN}/` or `${WEB_ORIGIN}/login?error=<code>`. |
| `GET /auth/me` | Session | `{ id, email, emailVerifiedAt, role }`. |
| `POST /users/invites/accept` | No | `{ token, password }`. Link is `/invite?token=...`. |
| `GET /batches/models` | Session | `{ models, defaultModel, ready }`. `models` is the live free OpenRouter catalog (name, description, context, scores, JSON support). A list description may end in `...`. `POST /batches` accepts only those ids. `ready` is false when `OPENROUTER_API_KEY` is empty. |
| `GET /batches/models/description` | Session | `?model=` a free-model id. `{ description }` is the full blurb from that model's page. |
| `POST /batches` | Session | `{ title, tags, comments, model }`. Tags 2-8 unique, up to 40 chars. `comments` is 1-100 strings, each up to 2,000 chars; line breaks stay inside that comment. One BullMQ job `{ itemId }` per comment. |
| `GET /batches`, `GET /batches/:id` | Session | Company-wide. Not scoped to the caller. |
| `POST /batches/:id/comments` | Session | `{ comments }`, one per line. Appends rows up to 100 total and queues each one on the batch's model. Audited as `batch.add_comments` with a count, never comment text. |
| `PATCH /batches/:id/items/:itemId` | Session | `{ finalTag }`, one of the batch tags. A blank value clears the tag. Audited. |
| `POST /batches/:id/accept-suggested` | Session | Sets `finalTag` only where empty. |
| `GET /batches/:id/export` | Session | `text/csv` with `Content-Disposition`. Audited. |
| `DELETE /batches/:id/items/:itemId` | Session | Deletes that comment, its conversation, and its pending job. Audited as `item.delete` with position and whether a conversation was removed. No comment text. |
| `DELETE /batches/:id` | Admin | Deletes batch, items, conversations, pending jobs. Audited with counts. |
| `GET /conversations`, `GET /conversations/:id` | Session | The token user's conversations. 404 for someone else's. A conversation is owned by the batch creator. |
| `POST /conversations/:id/messages` | Session | `{ content }`. Replies from the conversation's stored provider and model. Never changes `finalTag`. |
| `GET /consumer` | Session | `{ running }`. Open to every signed-in user; the review screen shows "Coding is paused". |
| `PATCH /consumer` | Admin | `{ "running": true \| false }`. Pause state lives only in this process. |
| `GET /connections`, `POST /connections/:tool/test` | Admin | Tools: `database`, `redis`, `model`, `mail`, `identity`. States `connected`, `not_configured`, `check_failed`. Secrets are never returned. Test writes an audit event. |
| `GET /settings`, `PATCH /settings` | Admin | `retentionDays` (`null` = keep until deleted, else 1-3650). `modelAllowlist` is still stored and is not what the new-batch form uses. |
| `GET /users`, `GET /users/invites`, `POST /users/invites`, `PATCH /users/:id` | Admin | People, pending invites, send invite `{ email, role }`, disable or enable and change role. Last active admin and self cannot be disabled or demoted. |
| `GET /audit` | Admin | Events newest first. No delete route exists. |
| `GET /producer`, `GET /producer/:id`, `DELETE /producer`, `DELETE /producer/:id` | Session; deletes admin | Raw queue inspection. Nothing creates jobs here. The SPA does not use it. |

## How a comment becomes a tag

`ConsumerProcessor` (`backend/src/consumer/consumer.processor.ts`) runs in the API process. There is no second worker service. Concurrency is 1 and the limiter is `MODEL_REQUESTS_PER_MINUTE`.

- Each job carries only `{ itemId }`. The worker loads the item and skips the model when it is already `coded` or `needs_review`.
- `FeedbackCodingService` calls `AiService.generateObject` with provider `openrouter` and the batch's free model. A tag in the batch list saves `coded`. Unusable output or an unknown tag saves `needs_review` and does not retry. A model that has left the free list fails once, without retries. A rate limit, network error, or missing key throws, and BullMQ retries 3 times with backoff.
- It then writes a conversation through `ConversationService.createInitial` so Ask can reuse the follow-up route.
- Pause state survives only for the life of the process. A restart comes back running.

`AiService.create(overrides)` builds one adapter. Call-site fields override adapter fields, which override env.

## Retention

`RetentionService` (`backend/src/retention/`) runs inside the API: once about a minute after boot and then every 24 hours. When `retentionDays` is set it calls `BatchService.purgeCreatedBefore`, which deletes older batches with their items, conversations, and jobs, and writes one `retention.purge` audit event with counts and no comment text. Empty means keep. Run a single API process.

## Company login

`backend/src/auth/oidc/`. Authorization-code flow with PKCE, a signed `oidc_state` cookie, and the userinfo endpoint (no ID-token parsing). `OidcClient` takes an injectable `fetch`, so tests mock the provider. An existing active user signs in by email. An unknown email is refused unless an invite for it is pending. The password form stays for the bootstrap admin.

## Code map

| Area | Files |
| --- | --- |
| Boot, origin check, validation | `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/security/origin.ts` |
| Env and production guards | `backend/src/config/*.ts` |
| Schema | `backend/src/database/database.module.ts` (entities and migrations are listed by hand), `backend/src/database/migrations/`. Add new entities there. Development uses `synchronize`; production runs migrations. |
| Queue | `backend/src/queue/` |
| Batches and CSV | `backend/src/batch/` |
| Worker | `backend/src/consumer/consumer.processor.ts`, `consumer.service.ts` |
| Transcripts | `backend/src/conversation/` |
| Models | `backend/src/ai/`. |
| Auth, roles, session cookie, OIDC | `backend/src/auth/` |
| People and invites | `backend/src/users/` |
| Connections, settings, audit, retention | `backend/src/connections/`, `settings/`, `audit/`, `retention/` |
| SPA | `frontend/src/` (see layers below) |

Backend TypeScript is ESM (`"type": "module"`, `module: nodenext`). Relative imports in `backend/src` and `backend/test` use a `.js` suffix, including imports of `.ts` files. `nest start --watch` and Vitest both require that suffix.

`neon.ts` sets `auth: false` and a 7-day TTL for new non-default Neon branches. Do not wire Neon Auth into this app.

## Frontend layers

A visual rewrite replaces `ui/` and `screens/` only. Keep the direction of imports, which `frontend/.oxlintrc.json` enforces:

| Folder | Holds | May import |
| --- | --- | --- |
| `api/` | `fetch` with `credentials: 'include'`, one file per area. No React. | `domain/` |
| `domain/` | Types and pure helpers such as progress counts. | nothing from other layers |
| `features/` | Hooks that return data and actions. No JSX, no CSS. | `api/`, `domain/` (not `ui/`, `screens/`) |
| `session/` | Auth context. | `api/`, `domain/` (not `ui/`, `screens/`) |
| `ui/` | Primitives and the shell, CSS modules and `tokens.css`. | none of the layers above |
| `screens/` | Pages. Product copy lives here. | everything else |
| `routes.tsx`, `guards.tsx` | Route table and guards. | `screens/`, `session/` |

Frontend files are UTF-8. Do not write them with PowerShell `Set-Content`. Do not add Tailwind, a component library, or CSS-in-JS. Calls use the `/api` prefix through `api/client.ts`. A browser navigation such as company login uses `apiUrl()` from the same file.

## Tests

From `backend/`:

- `npm test` — Vitest, include `**/*.spec.ts` (`vitest.config.ts`). Mocked. Safe without Redis, Postgres, or keys. Covers batch limits, the processor, audit rows, connections, disable, OIDC with a mocked provider, and the retention deleter.
- `npm run test:e2e` — include `**/*.e2e-spec.ts`. `test/app.e2e-spec.ts` imports `AppModule` and needs `DATABASE_URL` plus Redis. `test/openrouter.live.e2e-spec.ts` skips itself when `OPENROUTER_API_KEY` is empty; with a key it writes to Postgres and calls OpenRouter.
- `npm run lint` — oxlint, type-aware, on `src/` and `test/`.
- `npm run build` — `nest build` into `backend/dist`. Do not hand-edit `dist/`.

From `frontend/`: `npm run lint`, and `npm run build` (`tsc -b` then `vite build`). No unit tests.

## When something fails

| Symptom | Fix |
| --- | --- |
| `DATABASE_URL is required` | Set it in `backend/.env` or repo-root `.env.local`, then start from `backend/`. |
| `Refusing to start in production: ...` | The message lists each missing or default value. Fix them all in the environment. |
| Boot or `/queue/status` hangs or throws a Redis error | Start Redis on `6379`, or set `REDIS_*`. |
| `Registration is closed` | Expected. Use the bootstrap admin, then invite people. Or set `ALLOW_PUBLIC_REGISTER=true` in development. |
| No admin exists | Bootstrap only runs on an empty user table. Use a fresh dev database, or set `role = 'admin'` on a user in a dev database. |
| `Failed to send invitation email` | Run Mailpit on port 1025, or point `SMTP_HOST` and `SMTP_PORT` at a relay. The invite is not saved when mail fails. |
| `Choose a free OpenRouter model` | The id is not on the current free OpenRouter list. |
| `OpenRouter is not connected` | Set `OPENROUTER_API_KEY` and restart the API. |
| Connection shows `not_configured` | The message names the variable. Set it and restart. |
| Comments stay `queued` | The worker is paused (`GET /consumer` returns `{ "running": false }`; an admin resumes it), Redis is down, or the provider key is missing. |
| An item is `failed` | The worker threw after its retries. `failedReason` is on the item. |
| An item is `needs_review` | The model returned unusable output or a tag outside the batch list. Set the tag by hand. |
| Browser calls fail with 403 `Origin not allowed` | The page origin is not `WEB_ORIGIN`. |
| Login works in curl and the SPA still looks logged out | The SPA relies on the `session` cookie through the `/api` proxy. A request that bypasses the proxy sets the cookie for another origin. |
| Company login returns to `/login?error=...` | `oidc_not_invited`: no pending invite. `oidc_disabled`: person is disabled. `oidc_unverified`: the provider says the email is unverified. `oidc_failed`: state, token, or userinfo failed; check the API log and Test on Identity. |
| Schema looks stale or empty in dev | `synchronize: true` applies entity changes on boot to whatever `DATABASE_URL` points at. Use a dev database. |

Do not add a root `start` script, a Docker Compose file, or a second worker package unless the task asks for that. The worker is `ConsumerProcessor` inside the API.
