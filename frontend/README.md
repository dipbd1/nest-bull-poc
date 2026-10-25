# Frontend

Vite + React 19 single-page app for the feedback coding desk. The API runbook is [../README.md](../README.md). Agent constraints are in [../AGENTS.md](../AGENTS.md).

## Commands

Run these in `frontend/`.

```powershell
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite on `http://localhost:5173`. |
| `npm run build` | `tsc -b`, then `vite build`. |
| `npm run preview` | Serve the production build. |
| `npm run lint` | oxlint. |

There is no test script. The API must already be on `http://localhost:3000`. Vite proxies `/api/*` to it and strips the prefix, so the `session` cookie is first-party. The API accepts only the `WEB_ORIGIN` origin (default `http://localhost:5173`), so leave the Vite port unchanged unless that changes.

## Env

Leave `VITE_API_BASE_URL` unset so the app calls same-origin `/api`. Copy `.env.example` to `.env` only to point the client elsewhere, then restart `npm run dev`. Only `VITE_` variables are visible in client code.

## Layers

A visual rewrite replaces `src/ui/` and `src/screens/` only.

- `api/`: fetch calls with credentials. No React. Imports `domain/`.
- `domain/`: types and pure helpers. Imports nothing else.
- `features/`: hooks with data and actions. No JSX or CSS.
- `session/`: auth context. The session is an httpOnly cookie named `session`; nothing is stored in `localStorage`.
- `ui/`: primitives and shell, CSS modules, `tokens.css`. Imports no other layer.
- `screens/`: pages and product copy.
- `routes.tsx`, `guards.tsx`: route table and guards.

`.oxlintrc.json` enforces the import direction.

## Routes

| Path | Screen | Who |
| --- | --- | --- |
| `/login` | Sign in, optional "Continue with company login" | Anyone |
| `/invite?token=...` | Accept an invitation | Anyone with a link |
| `/` | Batches | Signed in |
| `/batches/new` | New batch | Signed in |
| `/batches/:batchId` | Review, accept suggested, export, delete (admin), pause (admin) | Signed in |
| `/batches/:batchId/items/:itemId/ask` | Ask about one comment | Signed in |
| `/connections`, `/people`, `/audit` | Admin screens | Admin |