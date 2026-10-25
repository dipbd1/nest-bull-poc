# nest-bull-poc

A feedback coding desk for one company on its own server. A reviewer pastes comments, picks tags, and leaves. A BullMQ worker in the API process asks the company's own model endpoint to tag each comment. The reviewer fixes tags, accepts the rest, exports a CSV, and can ask about one row. Admins connect tools, invite people, pause coding, set retention, and read the audit log.

One installation is one company. The app has no tenant switch and does not phone home. Operators follow [docs/operations.md](docs/operations.md).

## Layout

This is not an npm workspace. Each app has its own lockfile and `node_modules`.

| Path | What it is |
| --- | --- |
| `backend/` | NestJS 12 API, BullMQ worker, TypeORM, auth, and the AI client. Package name is `producer`. |
| `frontend/` | Vite + React 19 single-page app. Calls same-origin `/api`. |
| `docs/operations.md` | The operator SOP: install, connect, invite, back up, rotate, delete, retain. |
| `neon.ts` | Neon branch config only. App auth is the backend's own JWT, not Neon Auth. |
| Root `package.json` | `@neon/config` and `@neon/env` only. It has no `start` script. |

Install and run commands from `backend/` and `frontend/`. Installing only at the repo root does not install the app.

## What must be running

The API process exits or rejects requests when any of these are missing.

1. **Node.js 20.12 or newer.** Nest requires Node 20. Config loading uses `process.loadEnvFile`, which landed in 20.12.
2. **Postgres with TLS**, via `DATABASE_URL`. In development TypeORM uses `synchronize: true`, so the URL must be a dev database. Production runs the committed migrations instead. `neon deploy` writes the pooled URL to repo-root `.env.local`.
3. **Redis** for BullMQ. Defaults are `localhost:6379`, no password, queue name `jobs`. Nothing in this repo starts Redis.
4. **OpenRouter** for coding a comment. The reviewer picks a free model. Ask uses the provider stored on that conversation.
5. **SMTP** (default `localhost:1025`) for invitation mail. [Mailpit](https://github.com/axllent/mailpit) uses that port in development.

## Setup

From `backend/`:

```powershell
Copy-Item .env.example .env
npm install
```

In bash, copy the example with `cp .env.example .env`.

Edit `backend/.env` before starting:

- `DATABASE_URL` — required.
- `OPENROUTER_API_KEY` — required before a batch can be created or coded. Ask uses the provider stored on the conversation.
- `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` — creates the first admin when the user table is empty. Remove both after the first sign-in.
- `ALLOW_PUBLIC_REGISTER=true` — optional local-dev switch for self-registration. Ignored in production. With `EMAIL_VERIFICATION_REQUIRED` true (the default) registration emails a 6-digit code, so set it to `false` when you have no mail server.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS` — only when Redis is not local and open.
- `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` — optional company login.

Env files, in the order the API loads them: `backend/.env`, then repo-root `.env.local`. The first file wins when a key is set in both. A variable already in the process environment beats both files. Start the API with `backend/` as the working directory.

From `frontend/`:

```powershell
npm install
```

`frontend/.env` is optional. Leave `VITE_API_BASE_URL` unset so the app calls same-origin `/api`. Restart Vite after changing it.

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
- App: `http://localhost:5173`
- Sign-in: `http://localhost:5173/login`

Vite proxies `/api/*` to the API and strips the `/api` prefix, so the browser sees one origin and the session cookie is first-party. The API allows only the `WEB_ORIGIN` origin (default `http://localhost:5173` in development).

## Check that it booted

```powershell
Invoke-RestMethod http://localhost:3000/
Invoke-RestMethod http://localhost:3000/queue/status
Invoke-RestMethod http://localhost:3000/auth/config
```

`/` returns `Hello World!`. `/queue/status` returns job counts and proves Redis is connected. `/auth/config` returns `emailVerificationRequired`, `publicRegistration`, and `companyLogin`.

## Sessions

Sign-in sets an `httpOnly` cookie named `session` (`SameSite=Lax`, `Secure` in production). The SPA keeps no token in `localStorage`. A 401 sends the browser back to sign-in. Scripts can send `Authorization: Bearer <accessToken>` instead; the login response still returns `accessToken` for that.

## HTTP surface

Every route below is relative to the API root. Through the proxy the browser uses the same paths under `/api`. The global validation pipe rejects unknown JSON fields with 400. "Admin" means a signed-in user whose role is `admin`; anyone else gets 403.

| Method and path | Who | What |
| --- | --- | --- |
| `GET /`, `GET /queue/status` | Anyone | Health and queue counts. |
| `GET /auth/config` | Anyone | `{ emailVerificationRequired, publicRegistration, companyLogin }`. |
| `POST /auth/login`, `POST /auth/logout` | Anyone | Sets or clears the `session` cookie. |
| `POST /auth/register`, `POST /auth/register/verify` | Anyone, only when public registration is on | 403 `Registration is closed` otherwise. |
| `GET /auth/oidc/start`, `GET /auth/oidc/callback` | Anyone | Company login redirects. Browser navigations, not fetch calls. |
| `GET /auth/me` | Signed in | `{ id, email, emailVerifiedAt, role }`. |
| `POST /users/invites/accept` | Anyone with a token | `{ token, password }`. Link is `/invite?token=...`. |
| `GET /batches/models` | Signed in | Free OpenRouter models, the suggested default, and whether the key is set. List descriptions may end in `...`. |
| `GET /batches/models/description` | Signed in | `?model=` a free-model id. `{ description }` is the full blurb from that model's page. |
| `POST /batches` | Signed in | `{ title, tags, comments, model }`. 2-8 unique tags, 1-100 comment strings (line breaks stay in the comment), model on the free list. Queues one job per comment. |
| `GET /batches`, `GET /batches/:id` | Signed in | Company-wide batches with progress counts, and one batch with its items. |
| `POST /batches/:id/comments` | Signed in | `{ comments }`, one per line. Appends rows up to 100 total and queues each one on the batch's model. |
| `PATCH /batches/:id/items/:itemId` | Signed in | `{ finalTag }`, one of the batch tags. A blank value clears the tag. |
| `POST /batches/:id/accept-suggested` | Signed in | Fills `finalTag` only where it is empty. |
| `GET /batches/:id/export` | Signed in | `text/csv` with a `Content-Disposition` filename. |
| `DELETE /batches/:id/items/:itemId` | Signed in | Removes that comment, its conversation, and its pending job. |
| `DELETE /batches/:id` | Admin | Removes the batch, items, and conversations. |
| `GET /conversations`, `GET /conversations/:id`, `POST /conversations/:id/messages` | Signed in | Ask about one row. A conversation belongs to the person who created the batch; anyone else gets 404. A reply never changes `finalTag`. |
| `GET /consumer` | Signed in | `{ running }`. False while coding is paused. |
| `PATCH /consumer` | Admin | `{ "running": true \| false }` pauses or resumes the worker. |
| `GET /connections`, `POST /connections/:tool/test` | Admin | State of `database`, `redis`, `model`, `mail`, `identity`, with secrets redacted. Test writes an audit event. |
| `GET /settings`, `PATCH /settings` | Admin | `retentionDays` (null keeps batches until deleted). `modelAllowlist` is stored and does not limit the new-batch form. |
| `GET /users`, `GET /users/invites`, `POST /users/invites`, `PATCH /users/:id` | Admin | List people, send an invite (`{ email, role }`), disable or enable, change role. |
| `GET /audit` | Admin | Audit events, newest first. There is no delete route. |
| `GET /producer`, `GET /producer/:id` | Signed in | Raw queue job inspection. `DELETE /producer` and `DELETE /producer/:id` are admin-only. Nothing creates jobs here. |

## Production boot rules

With `NODE_ENV=production` the API refuses to start unless `WEB_ORIGIN`, a non-default `JWT_SECRET`, `DATABASE_URL`, `REDIS_HOST`, and the key for `AI_DEFAULT_PROVIDER` are all set. It lists every problem at once. It also turns off schema synchronize and runs the committed migrations, marks the cookie `Secure`, and ignores `ALLOW_PUBLIC_REGISTER`. Development keeps its defaults. See [docs/operations.md](docs/operations.md).

## Frontend layers

`frontend/src` is split so a visual rewrite stays inside `ui/` and `screens/`:

- `api/` fetch calls with credentials included. No React. May import `domain/`.
- `domain/` types and pure helpers. Imports nothing from the other layers.
- `features/` hooks that return data and actions. No JSX or CSS. Must not import `ui/` or `screens/`.
- `session/` the auth context. Must not import `ui/` or `screens/`.
- `ui/` visual primitives and the shell, with CSS modules and `tokens.css`. Imports none of the layers above.
- `screens/` compose hooks and primitives. Product copy lives here.
- `routes.tsx` and `guards.tsx` wire screens to paths.

`frontend/.oxlintrc.json` enforces that direction. Do not add Tailwind, a component library, or CSS-in-JS.

## Tests and lint

From `backend/`:

```powershell
npm test
npm run test:e2e
npm run lint
```

`npm test` runs `*.spec.ts`. Those specs mock the queue, the database, the identity provider, and the model client. They do not need Redis, Postgres, or an API key.

`npm run test:e2e` runs `*.e2e-spec.ts`. `test/app.e2e-spec.ts` boots the real `AppModule`, so `DATABASE_URL` and Redis must be up. `test/openrouter.live.e2e-spec.ts` is skipped unless `OPENROUTER_API_KEY` is set, and then it calls OpenRouter and Postgres.

From `frontend/`:

```powershell
npm run lint
npm run build
```

The frontend has no test script.

## More detail

[docs/operations.md](docs/operations.md) is the operator SOP. [AGENTS.md](AGENTS.md) is the operating guide for coding agents: env precedence, module map, and the failures that look like application bugs. Package notes are in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
