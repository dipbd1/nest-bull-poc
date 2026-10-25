# Operations guide

This is the SOP for the person who runs one installation of the feedback coder for one company. It covers what the app stores, what leaves the server, how to install and connect it, and the routine tasks. It ends with what the app does not do, so a security questionnaire can be answered from one page.

This is not a certification. A SOC 2 report, an ISO 27001 certificate, or a HIPAA attestation audits the company that operates the server. This repo gives you the product side: data stays in your Postgres, secrets stay in your environment, access is role-based and revocable, and sensitive actions are logged.

One installation is one company. A second company is a second installation with its own database. There is no tenant switch.

## 1. What is stored, and what leaves the server

Stored in your Postgres:

- People: email, a password hash, role (`admin` or `reviewer`), a disabled flag, and a session version. Invites store a hash of the link token, never the token.
- Batches: title, tags, the model id, and each comment's text, suggested tag, summary, final tag, and status.
- Conversations: the model's reply for each comment and any follow-up questions asked on the Ask screen. These contain comment text.
- Settings: the keep period in days. A model allowlist column remains in the database and is not what the new-batch form uses. Neither is a secret.
- Audit events: who did what and when, with ids, counts, tag names, and email addresses. Audit rows never hold comment text and there is no API to delete them.

Stored in your Redis: BullMQ job records. A job carries only an item id, not the comment.

Not stored anywhere in the app: API keys, the database URL, SMTP passwords, the OIDC client secret. They are read from the environment. The Connections screen shows a state and non-secret details such as a host or a base URL. It never shows a secret.

Only two paths send data off the server:

1. **OpenRouter.** The worker sends a comment, the batch tags, and a fixed instruction to the free model chosen for the batch. Ask sends the conversation so far to the provider stored on that conversation. The Connections test sends the single word prompt "Reply with the single word OK." and no customer text.
2. **Your SMTP server.** Invitation mail carries an email address and a link. Registration codes use it only when public registration is on.

Company login (optional) adds browser redirects to your identity provider and two server-to-server calls to it (token and userinfo). No comment text goes there.

There is no analytics script, no error-reporting service, and no call to any service run by the authors of this repo.

## 2. Install

You need Node.js 20.12 or newer, Postgres that accepts TLS, and Redis. This repo does not start either one.

```bash
cd backend
cp .env.example .env
npm install
npm run build
```

Put your values in `backend/.env`, or inject them from your secret manager into the process environment. A variable already present in the environment wins over `backend/.env`. Do not commit `.env`.

Variables the app reads:

| Variable | Required in production | Notes |
| --- | --- | --- |
| `NODE_ENV` | Set to `production` | Turns on the guards below, turns off schema sync, and marks the session cookie `Secure`. |
| `WEB_ORIGIN` | Yes | The one browser origin, for example `https://feedback.example.com`. Also used in invitation links and as the OIDC redirect base. |
| `DATABASE_URL` | Yes | Postgres URL with TLS. |
| `REDIS_HOST`, `REDIS_PORT` | `REDIS_HOST` yes | Port defaults to 6379. |
| `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS` | No | `REDIS_TLS` is `true`, `1`, or `yes`. |
| `JOB_QUEUE_NAME` | No | Default `jobs`. |
| `JWT_SECRET` | Yes, not `dev-jwt-secret` | Signs sessions. Use a long random value. |
| `JWT_EXPIRES_IN` | No | Default `1d`. |
| `AI_DEFAULT_PROVIDER` | Yes | One of `openai`, `anthropic`, `gemini`, `openai-compatible`, `openrouter`. Production boot still checks this provider's key. Batch coding does not use it. |
| `OPENROUTER_API_KEY` | For batches | Required before a reviewer can create or code a batch. `OPENROUTER_MODEL` is the suggested picker default only when that id is free. |
| That provider's key and model | The key, for boot | `OPENAI_API_KEY` and `OPENAI_MODEL`; `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`; `GOOGLE_GENERATIVE_AI_API_KEY` and `GEMINI_MODEL`; or `OPENAI_COMPATIBLE_BASE_URL` (plus `OPENAI_COMPATIBLE_API_KEY` if it needs one) and `OPENAI_COMPATIBLE_MODEL`. Each provider also has an optional `*_BASE_URL`. |
| `MODEL_REQUESTS_PER_MINUTE` | No | Worker throttle. Default 20. Concurrency is fixed at 1. |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | For invitations | Defaults are `localhost`, `1025`, `noreply@localhost`. The app does not use TLS or SMTP credentials on this connection, so point it at a relay that accepts your server. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Only for first start | Creates the first admin when the user table is empty. See step 5. |
| `ALLOW_PUBLIC_REGISTER` | Never | A local-dev switch. Ignored when `NODE_ENV=production`. |
| `EMAIL_VERIFICATION_REQUIRED` | No | Applies to public registration only. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Optional | All three turn on company login. See step 6. |
| `PORT` | No | Default 3000. |

**Production boot guards.** With `NODE_ENV=production` the API refuses to start, and lists every problem at once, when any of these is true:

- `WEB_ORIGIN` is missing or is not an absolute URL.
- `JWT_SECRET` is missing or is `dev-jwt-secret`.
- `DATABASE_URL` is missing.
- `REDIS_HOST` is missing.
- The API key for `AI_DEFAULT_PROVIDER` is missing. For `openai-compatible` the base URL stands in for the key.

In production, TypeORM does not synchronize the schema. It runs the committed migrations on boot, which create the tables, including audit, invites, and settings. In development `synchronize` stays on, so never point a development process at the company database.

Start the API from `backend/` with `npm run start:prod` under your process manager. Run exactly one API process: the worker, the pause switch, and the retention job all live in it.

Serve the built UI from `frontend/dist` (`cd frontend && npm install && npm run build`).

## 3. One HTTPS hostname

Put the UI and the API on one hostname behind your reverse proxy:

- `/` serves the files in `frontend/dist`, with a fallback to `index.html` for client routes such as `/login` and `/invite`.
- `/api/*` goes to the Nest process with the `/api` prefix removed. The Nest routes have no `/api` prefix. Forward `/api/auth/login` as `/auth/login`.

Set `WEB_ORIGIN` to that origin, for example `https://feedback.example.com`. The API rejects any request whose `Origin` header differs from it, and it sets the `session` cookie as `httpOnly`, `SameSite=Lax`, and `Secure`. Terminate TLS at the proxy. Without HTTPS the browser will not keep the cookie.

The session lives in that cookie. The app writes nothing to `localStorage`.

## 4. Connect each tool and run Test

Start the API, open `WEB_ORIGIN/login`, and sign in as the bootstrap admin. Open **Connections**. Each tool shows `connected`, `not configured`, or `check failed`:

| Tool | Reads | Test does |
| --- | --- | --- |
| Database | `DATABASE_URL` | Runs `SELECT 1`. |
| Queue | `REDIS_HOST`, `REDIS_PORT`, auth and TLS flags | Asks Redis for its info. |
| Model | `OPENROUTER_API_KEY` | Sends a one-word prompt to the suggested free OpenRouter model. No customer text. |
| Mail | `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | Opens an SMTP connection and greets. Sends no mail. |
| Identity | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Fetches the provider's discovery document. Shows `not configured` when unset. |

A missing value is reported as `not configured` with the variable to set. Fix it in the environment and restart. Every Test writes an audit event with the tool name and the result.

On the same screen, **Keep period** sets how long batches are kept. Reviewers choose a free OpenRouter model on the new-batch form. Batch creation accepts only an id from that live list, and refuses to save a batch when `OPENROUTER_API_KEY` is empty.

## 5. Remove the bootstrap password

The bootstrap variables only matter on an empty user table. After the first successful sign-in:

1. Remove `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from the environment.
2. Restart the API.
3. Invite a second admin on **People** so there is more than one way in. The app will not let you disable or demote the last active admin or yourself.

The password form stays on the sign-in screen so an admin can still get in when the identity provider is down.

## 6. Company login (optional)

Set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`, then restart. The sign-in screen then offers **Continue with company login**, and Connections shows Identity as connected.

At your identity provider, register an OpenID Connect web client with:

- Redirect URI: `${WEB_ORIGIN}/api/auth/oidc/callback`, for example `https://feedback.example.com/api/auth/oidc/callback`.
- Scopes `openid email profile`, the authorization-code flow, and PKCE. The provider must publish `/.well-known/openid-configuration` with token and userinfo endpoints, and must return `email` from userinfo.

Rules the app applies:

- An existing active person signs in by email.
- A person with no account is refused unless an invite for that email is pending. Having an account at the provider is not enough. The invite supplies the role, and signing in consumes it.
- A disabled person is refused unless a new invite is pending.
- A provider that reports `email_verified: false` is refused.
- Refusals are written to the audit log with the email and the reason.

## 7. Invite a reviewer and disable a leaver

**People → Invite.** Enter an email and a role. The app mails a link of the form `WEB_ORIGIN/invite?token=...` through your SMTP server. It expires in 7 days. The invited person sets a password, or uses company login if you turned it on. If mail fails, the invite is not created. Check the Mail tool on Connections.

**People → Disable.** Disabling bumps the person's session version, so their next request is rejected and the browser is sent back to sign-in. To confirm: ask them to reload any page, or open **Audit** and find the `user.disable` event. Re-enable by choosing Enable, or send a new invite.

## 8. Back up

Back up Postgres with your own procedure. Everything the app keeps is there, including the audit log. Restore is your database procedure. Redis holds only in-flight job records and can be rebuilt. After a restore, lost queued comments can be recoded by creating a new batch.

Keep `backend/.env` or your secret manager entries in your own backup, separately from the database.

## 9. Rotate secrets

Edit the environment, then restart the API.

- `JWT_SECRET`: every session is invalidated, so everyone signs in again. Outstanding registration codes also stop working. Pending invites keep working.
- Model key (`OPENAI_API_KEY` and the others): then open Connections and run Test on Model.
- SMTP password: this app connects to SMTP without credentials. If your relay requires them, rotate them in the relay or its allow-list of the server's address.
- `OIDC_CLIENT_SECRET`: rotate at the provider, update the environment, restart, and run Test on Identity.
- Redis password or `DATABASE_URL`: update the environment, restart, and run Test on Queue or Database.

## 10. Delete a batch, or set retention

**Add comments to a batch.** On the open batch, paste more comments, one per line, and choose Add comments. The batch still holds at most 100. Each new comment is queued on the model already chosen for that batch. The audit log records `batch.add_comments` with the count and the model id, not the text.

**Delete one comment.** On the open batch, Delete on a row removes that comment, its Ask conversation, and any job still waiting. Coded rows and rows that failed can be deleted the same way. The audit log records `item.delete` with the batch id, the position, and whether a conversation was removed. It does not record the comment. `DELETE /batches/:id/items/:itemId` is open to every signed-in person.

**Clear a final tag.** On a row that has been coded, choose "Choose a tag" in Final tag. That saves an empty tag. Accept suggested can fill it again later.

**Delete one batch.** An admin opens the batch and deletes it. The batch, its comments, and their conversations are removed, and pending jobs are cancelled. The audit log records the batch id and counts. `DELETE /batches/:id` is admin-only.

**Retention.** On Connections, **Keep period**, set a number of days. Leave it empty to keep every batch until someone deletes it. The API runs a pass about a minute after it starts and then every 24 hours. Each pass deletes batches created more than that many days ago, with their comments and conversations. If it deleted anything, it writes one `retention.purge` audit event with the batch, comment, and conversation counts, the keep period, and the cutoff time. It never writes comment text. A pass that deletes nothing writes nothing.

Retention does not touch the audit log, so audit rows outlive the batches they describe. Their metadata holds counts and ids, not comments. Postgres backups taken before a deletion still contain the deleted data until you expire those backups.

## 11. What you still own

The app does not provide, and you must:

- **Disk and backup encryption** for Postgres, Redis, and backups.
- **Network policy.** Keep Postgres and Redis off the public internet. Allow outbound traffic from the API only to your model endpoint, your SMTP server, and your identity provider if used.
- **TLS certificate** and renewal for the hostname.
- **Identity provider administration**: who has accounts there, MFA, and offboarding. Disabling a person in this app does not disable them at the provider, and the reverse is not automatic either.
- **SMTP security.** The app's SMTP connection has no TLS and no login. Use a trusted relay.
- **The model provider's terms.** Comments reach the provider you configured, under that provider's data terms. A free or public endpoint is your choice and your risk.
- **Log handling.** The API logs to standard output. Ship and expire those logs yourself.
- **Your own compliance audit.** SOC 2, ISO 27001, HIPAA, and similar attestations cover your operation of this installation, not the code alone.
- **Updates.** Apply new releases and dependency fixes on your schedule, then restart.
