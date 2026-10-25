# Frontend

Vite + React 19 console for the queue API. The API runbook is [../README.md](../README.md). Agent constraints are in [../AGENTS.md](../AGENTS.md).

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

There is no test script. The API must already be on `http://localhost:3000`. CORS on the API allows only port 5173, so leave the Vite port unchanged unless `backend/src/main.ts` changes with it.

## Env

`VITE_API_BASE_URL` defaults to `http://localhost:3000` in `src/api.ts`. Copy `.env.example` to `.env` to override it, then restart `npm run dev`. Only `VITE_` variables are visible in client code.

## Routes

| Path | Page | API |
| --- | --- | --- |
| `/login` | Register, verify, and log in | `/auth/*` |
| `/` | Create and edit jobs. Requires a signed-in user. | `/producer`, `/producer/models` |
| `/consumers` | Pause the worker and continue a conversation | `/consumer`, `/conversations` |

The shell polls `GET /queue/status` every 3 seconds. The access token lives in `localStorage` under `accessToken` and is attached by `src/api.ts`.
