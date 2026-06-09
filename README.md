# BurgerGo

A mobile-first, single-user travel-planning PWA. Plan a trip day by day — places,
map + routes, restaurants, budget, packing, tasks, and a journal — and keep reading
it all offline once it's been loaded online.

> Personal app, deliberately no-auth. It runs at a private URL behind Cloudflare;
> there are no accounts and no multi-user model.

## Stack

- **Next.js 15** (App Router, output: `standalone`), **React 19**, **TypeScript** (strict).
- **Drizzle ORM** + **better-sqlite3** (one SQLite file, WAL, single writer).
- **Serwist** service worker (offline-first PWA).
- **Tailwind v3**; **next-intl** (English only).
- **Vitest** + Testing Library. `tsc --noEmit` is a required gate.
- Maps: **Mapbox GL** or **Google Maps JS** (build-time `NEXT_PUBLIC_MAP_PROVIDER`).
- Integrations: **Google Places/Directions** (server key, IP-restricted to prod) and
  **OpenAI** (place summaries + AI import). **Open-Meteo** for weather (no key).

## Architecture (the important bits)

- **Static shell + client fetch.** Pages are `force-static` so the SW can cache the
  document; each section's client component fetches its own data from `/api/...` on
  mount. Reads are public GET routes; writes are **online-only Server Actions**.
- **Offline = read-only.** The SW serves the last-seen trip data (NetworkFirst, with a
  3s lie-fi timeout), cached photos (CacheFirst), and visited page shells. Mutations
  need a connection. **The in-app map needs the network** to fetch tiles, so it can
  render blank offline — that's expected, and a deep-link list is offered as a fallback.
- **Days are derived**, never stored — computed from `start_date`/`end_date` + the
  container timezone, so "today" is consistent across server and client.
- Money is integer **minor units**. Photos are re-encoded to WebP derivatives
  (thumb/card/full). Link previews fetch through a strict SSRF guard.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000  (SW disabled in dev)
npm test               # vitest
npx tsc --noEmit       # required gate
npm run lint
npm run build          # gen icons + next build (also emits the SW)
```

Local SQLite lives at `./burgergo.db` (override with `DATABASE_PATH`); uploads at
`./uploads` (`UPLOADS_DIR`). Generate a migration after a schema change:

```bash
npm run db:generate
```

### Environment

`NEXT_PUBLIC_*` are inlined at build time (must be Docker build-args); the rest are
runtime-only. None are required for tests (safe defaults).

| Var | Purpose |
|-----|---------|
| `DATABASE_PATH`, `UPLOADS_DIR` | SQLite file + uploads dir |
| `NEXT_PUBLIC_MAP_PROVIDER` | `google` \| `mapbox` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_MAPBOX_TOKEN` | browser map key |
| `GOOGLE_MAPS_SERVER_KEY` | server-side Places/Directions (IP-restricted) |
| `OPENAI_API_KEY` | AI summaries + import (feature degrades off if unset) |
| `NEXT_PUBLIC_BASE_PATH` | sub-path deploy (e.g. `/burgergo`) |
| `BURGERGO_API_KEY` | optional `x-api-key` gate for MCP write endpoints |
| `TZ`, `DEFAULT_CURRENCY` | container timezone + currency |

## Deploy

`./scripts/deploy.sh` rsyncs the working tree to the server, builds the Docker image
there (so the native better-sqlite3 binary matches), and restarts. Migrations apply
automatically on container start. Live behind nginx (sub-path) + Cloudflare. See
`deploy/README.md`.

## Layout

```
app/                 routes: page shells, /api read handlers, _actions (writes)
components/          per-section clients (plan, eats, budget, packing, todo, journal) + map
src/db/              schema, repos, migrations (drizzle/)
src/lib/             pure helpers (days, planView, weather, map, google, openai, photos…)
scripts/            migrate (bundled to JS) + maintenance scripts
docs/superpowers/    specs + implementation plans
```
