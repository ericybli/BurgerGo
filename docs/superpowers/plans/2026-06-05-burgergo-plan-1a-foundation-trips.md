# BurgerGo Plan 1A — Foundation & Trips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the BurgerGo project skeleton and the Trips domain so the app is installable, offline-readable, and lets you create, rename, and browse trips.

**Architecture:** Next.js 15 App Router + TypeScript (strict) over SQLite via Drizzle ORM (better-sqlite3). A pure repository layer (every repo function takes a `db` argument) keeps data logic unit-testable against an in-memory SQLite; reads are exposed as cacheable JSON Route Handlers and mutations as Server Actions. A Serwist service worker precaches the app shell and stale-while-revalidates trip JSON so trips stay readable offline. Ships as a multi-stage Docker image backed by a SQLite volume + an uploads volume.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v3, Drizzle ORM + better-sqlite3, next-intl, Serwist (PWA), Vitest + Testing Library, sharp, Docker.

---

## Foundation & Conventions

Read these once; every task assumes them.

- **Scope of this plan (1A).** Project scaffolding, tooling, Docker, shared libs, the full Phase-1 DB schema (groundwork), the **Trips** domain (repos, Server Actions, read handlers, Home, trip shell, placeholder tabs), and the **PWA skeleton** (manifest, service worker, offline read of trips). **Out of scope (later plans):** the real Plan tab (Days/Saved toggles, drag-reorder, add-place, promote), the Google Maps JS map, Google Details/Geocode/Directions proxies, "Open in Google Maps" wiring on real places, the Today next-stop card, Eats, Budget, Journal, photo upload/serve, and travel-leg computation. The `travel_legs` and `place_details_cache` tables exist now as groundwork (only `place_details_cache` gets a repo).
- **Tooling.** npm + Node 22. Next.js 15 App Router, React 19, TypeScript `strict`. Path alias `@/*` → repo root (e.g. `@/src/db/client`, `@/components/TripCard`, `@/app/_actions/trips`).
- **Testing (TDD).** Vitest (jsdom env) + `@testing-library/react`/`jest-dom` for components; **DB/repo tests build an in-memory better-sqlite3 via `makeTestDb()`**. Repos are **pure** — every repo function takes the `db` instance as its first argument, so tests inject the test db and production passes the singleton from `src/db/client.ts`. Test files are colocated as `*.test.ts(x)`. The uniform repo db type is `import type { TestDb } from '@/src/db/testDb'; type Db = TestDb['db'];`.
- **Time.** `deriveDays(trip, tz)` and `tripStatus(trip, tz)` take exactly two args and read the system clock internally; tests control "today" with `vi.useFakeTimers()` + `vi.setSystemTime(...)`. "Today" is always resolved in the container `TZ`.
- **Money.** Stored as integer **minor units**; rendered via an ISO-4217 decimal-exponent map (`src/lib/currency.ts`).
- **Env.** `src/env.ts` (zod-validated): `DATABASE_PATH`, `UPLOADS_DIR`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY` (optional in dev), `DEFAULT_CURRENCY` (default `USD`), `DEFAULT_LANGUAGE` (default `en`), `TZ` (default `UTC`).
- **Palette tokens** (Tailwind theme + `app/globals.css` CSS vars): coral `#EE5B3C` (+press `#D94E30`), teal `#4F8A86`, ink `#6E5544` (+muted/faint), paper `#F5EEE1`, card `#FBF7EF`, sun `#F2C879`; radii card 16 / sheet 24 / chip 999 / control 12; shadows card/lift/inset. `--font-sans` = Inter (`--font-inter`) + Noto Sans SC (`--font-noto-sc`).
- **i18n base.** next-intl wired with **English messages only** (the EN/中文 toggle + `zh.json` come in a later plan). Every visible string comes from `messages/en.json`.
- **Commits.** Each task ends with a commit (conventional messages); follow the TDD rhythm: failing test → run (FAIL) → minimal impl → run (PASS) → commit. "Expected: N passed" counts are approximate — the binding check is **0 failures**.

## How tasks are organized

Tasks are grouped **A0 → A4** in strict dependency order; execute them in order. Each task is bite-sized (2–5 min/step) with complete code.

- **A0** — Scaffolding, tooling & shared libraries
- **A1** — Database schema, client, migrations & base repos
- **A2** — Trips repository, Server Actions & read handlers
- **A3** — Trips UI: layout, Home, trip shell & placeholder tabs
- **A4** — PWA skeleton, offline read & Docker

---

## File Map

All files created across this plan (grouped by responsibility):

**Config, tooling & Docker**
- `.dockerignore`
- `.env.example`
- `.gitignore`
- `.npmrc`
- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh`
- `drizzle.config.ts`
- `next.config.ts`
- `package.json`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `tsconfig.json`
- `vitest.config.ts`
- `vitest.setup.ts`

**Shared libs & env**
- `src/_tscheck.test.ts`
- `src/env.test.ts`
- `src/env.ts`
- `src/lib/__smoke.test.ts`
- `src/lib/clock.test.ts`
- `src/lib/clock.ts`
- `src/lib/currency.test.ts`
- `src/lib/currency.ts`
- `src/lib/days.test.ts`
- `src/lib/days.ts`
- `src/lib/googleMapsUrl.test.ts`
- `src/lib/googleMapsUrl.ts`

**Database, schema & repos**
- `src/db/client.test.ts`
- `src/db/client.ts`
- `src/db/ids.test.ts`
- `src/db/ids.ts`
- `src/db/repos/placeCache.test.ts`
- `src/db/repos/placeCache.ts`
- `src/db/repos/settings.test.ts`
- `src/db/repos/settings.ts`
- `src/db/repos/trips.test.ts`
- `src/db/repos/trips.ts`
- `src/db/schema.test.ts`
- `src/db/schema.ts`
- `src/db/testDb.test.ts`
- `src/db/testDb.ts`

**Server Actions**
- `app/_actions/trips.test.ts`
- `app/_actions/trips.ts`

**API route handlers**
- `app/api/health/route.test.ts`
- `app/api/health/route.ts`
- `app/api/trips/[tripId]/route.test.ts`
- `app/api/trips/[tripId]/route.ts`
- `app/api/trips/route.test.ts`
- `app/api/trips/route.ts`

**i18n**
- `i18n/request.test.ts`
- `i18n/request.ts`
- `messages/en.json`

**Components**
- `components/BottomTabBar.test.tsx`
- `components/BottomTabBar.tsx`
- `components/EmptyState.test.tsx`
- `components/EmptyState.tsx`
- `components/HomeClient.test.tsx`
- `components/HomeClient.tsx`
- `components/NewTripSheet.test.tsx`
- `components/NewTripSheet.tsx`
- `components/OfflineBanner.test.tsx`
- `components/OfflineBanner.tsx`
- `components/RenameSheet.test.tsx`
- `components/RenameSheet.tsx`
- `components/SWRegister.test.tsx`
- `components/SWRegister.tsx`
- `components/TripCard.test.tsx`
- `components/TripCard.tsx`
- `components/TripHeader.test.tsx`
- `components/TripHeader.tsx`

**App Router pages & layouts**
- `app/(home)/layout.tsx`
- `app/(home)/page.tsx`
- `app/(home)/settings/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/sw.test.ts`
- `app/sw.ts`
- `app/trip/[tripId]/budget/page.tsx`
- `app/trip/[tripId]/eats/page.tsx`
- `app/trip/[tripId]/journal/page.tsx`
- `app/trip/[tripId]/layout.tsx`
- `app/trip/[tripId]/page.tsx`
- `app/trip/[tripId]/plan/page.tsx`

**PWA & public assets**
- `public/manifest.webmanifest`
- `public/manifest.webmanifest.test.ts`

**Scripts**
- `scripts/gen-icons.test.ts`
- `scripts/gen-icons.ts`
- `scripts/migrate.test.ts`
- `scripts/migrate.ts`

---

## Tasks

### Task A0.1: Initialize npm project, deps, scripts, and base config files

**Files:**
- Create: `package.json`
- Create: `.gitignore` (modify existing)
- Create: `.npmrc`

This task is pure infra (no test). It produces an installable project so every later task can run `npm test`.

- [ ] **Step 1: Write the exact `package.json`.**
  Create `package.json` with the contracted dependency set, versions, and scripts:
  ```json
  {
    "name": "burgergo",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "engines": {
      "node": ">=22"
    },
    "scripts": {
      "dev": "next dev",
      "build": "npm run gen:icons && next build",
      "start": "next start",
      "lint": "next lint",
      "test": "vitest run",
      "test:watch": "vitest",
      "db:generate": "drizzle-kit generate",
      "gen:icons": "tsx scripts/gen-icons.ts"
    },
    "dependencies": {
      "next": "^15",
      "react": "^19",
      "react-dom": "^19",
      "drizzle-orm": "^0.36",
      "better-sqlite3": "^11",
      "next-intl": "^3",
      "@serwist/next": "^9",
      "serwist": "^9",
      "zod": "^3"
    },
    "devDependencies": {
      "typescript": "^5",
      "@types/node": "^22",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "@types/better-sqlite3": "^7",
      "drizzle-kit": "^0.28",
      "vitest": "^2",
      "@vitejs/plugin-react": "^4",
      "jsdom": "^25",
      "@testing-library/react": "^16",
      "@testing-library/jest-dom": "^6",
      "@testing-library/user-event": "^14",
      "tailwindcss": "^3",
      "postcss": "^8",
      "autoprefixer": "^10",
      "sharp": "^0.33",
      "tsx": "^4"
    }
  }
  ```
  (Note: `tsx` is added so the `gen:icons` script — invoked by `build` — runs the TypeScript `scripts/gen-icons.ts`; `@types/node` is needed for `process`/`Buffer`/`crypto` typings used by the libs in this group.)

- [ ] **Step 2: Write `.npmrc` to pin a deterministic install.**
  Create `.npmrc`:
  ```
  save-exact=false
  engine-strict=true
  fund=false
  audit=false
  ```

- [ ] **Step 3: Replace `.gitignore` with a full Node/Next ignore set.**
  Overwrite `.gitignore`:
  ```gitignore
  # dependencies
  node_modules/

  # next.js
  .next/
  out/
  next-env.d.ts

  # production / runtime
  build/
  *.db
  *.db-shm
  *.db-wal

  # generated service worker
  public/sw.js
  public/sw.js.map

  # generated PWA icons & served logo (produced by gen:icons)
  public/icons/
  public/burgergo-logo.png

  # env
  .env
  .env.local
  .env.*.local

  # testing
  coverage/

  # misc
  .DS_Store
  *.log
  ```
  (We git-ignore the generated `public/icons/` and `public/burgergo-logo.png` because the contract regenerates them at build via `gen:icons`; the source of truth is `assets/burgergo-logo.png`.)

- [ ] **Step 4: Install dependencies.**
  Run:
  ```bash
  npm install
  ```
  EXPECT: install completes and `node_modules/` plus `package-lock.json` are created. Verify with:
  ```bash
  test -f package-lock.json && node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')"
  ```
  EXPECT output: `better-sqlite3 OK`

- [ ] **Step 5: Commit.**
  ```bash
  git add package.json package-lock.json .npmrc .gitignore && git commit -m "chore: init npm project with pinned deps and scripts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.2: TypeScript config (strict + `@/*` alias)

**Files:**
- Create: `tsconfig.json`
- Create: `src/_tscheck.test.ts` (temporary alias-resolution smoke test, removed in Step 5)

- [ ] **Step 1: Write a failing test that the `@/*` alias resolves.**
  Vitest is not configured yet (that is A0.3), so this step uses a plain `tsc` typecheck as the "test." Create `src/sample.ts`:
  ```ts
  export const SAMPLE = 'burgergo' as const;
  ```
  Create `src/_aliascheck.ts`:
  ```ts
  import { SAMPLE } from '@/src/sample';

  export const checked: string = SAMPLE;
  ```

- [ ] **Step 2: Run the typecheck and watch it FAIL (no tsconfig yet).**
  ```bash
  npx tsc --noEmit src/_aliascheck.ts
  ```
  EXPECT: FAIL — `error TS2307: Cannot find module '@/src/sample'` (the alias is unresolved without `paths`).

- [ ] **Step 3: Write `tsconfig.json` (strict, bundler resolution, `@/*` → repo root).**
  Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "moduleDetection": "force",
      "allowJs": true,
      "skipLibCheck": true,
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noEmit": true,
      "esModuleInterop": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve",
      "incremental": true,
      "verbatimModuleSyntax": false,
      "types": ["node", "@testing-library/jest-dom"],
      "plugins": [{ "name": "next" }],
      "baseUrl": ".",
      "paths": {
        "@/*": ["./*"]
      }
    },
    "include": [
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      ".next/types/**/*.ts"
    ],
    "exclude": ["node_modules"]
  }
  ```
  (`@/*` → `./*` makes `@/src/db/client`, `@/components/TripCard`, `@/app/_actions/trips` all resolve from the repo root, exactly per the path-alias contract.)

- [ ] **Step 4: Run the typecheck and watch it PASS.**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  EXPECT: PASS — no output, exit code 0 (the `@/src/sample` import now resolves).

- [ ] **Step 5: Remove the temporary alias-check files.**
  ```bash
  rm src/_aliascheck.ts src/sample.ts && rmdir src 2>/dev/null; echo "cleaned"
  ```
  EXPECT output: `cleaned`

- [ ] **Step 6: Commit.**
  ```bash
  git add tsconfig.json && git commit -m "chore: add strict tsconfig with @/* path alias

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.3: Vitest config + setup (jsdom, jest-dom, `@/*` alias)

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/lib/__smoke.test.ts` (temporary; removed in Step 5)

- [ ] **Step 1: Write a failing smoke test that exercises jsdom + jest-dom + the `@/*` alias.**
  Create `src/lib/__smoke.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';

  describe('vitest harness', () => {
    it('runs in jsdom with a document', () => {
      const el = document.createElement('div');
      el.textContent = 'BurgerGo';
      document.body.appendChild(el);
      // toBeInTheDocument comes from @testing-library/jest-dom (loaded via setup file)
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent('BurgerGo');
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL (no vitest config yet).**
  ```bash
  npx vitest run src/lib/__smoke.test.ts
  ```
  EXPECT: FAIL — runs in the default `node` environment, so `document is not defined`, and `toBeInTheDocument` is not a known matcher (jest-dom not loaded).

- [ ] **Step 3: Write `vitest.setup.ts`.**
  Create `vitest.setup.ts`:
  ```ts
  import '@testing-library/jest-dom';
  ```

- [ ] **Step 4: Write `vitest.config.ts` (jsdom env, setup file, `@/*` alias, react plugin).**
  Create `vitest.config.ts`:
  ```ts
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';
  import { fileURLToPath } from 'node:url';

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['**/*.test.ts', '**/*.test.tsx'],
      exclude: ['node_modules', '.next', 'dist'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./', import.meta.url)),
      },
    },
  });
  ```
  (The alias maps `@` to the repo root, mirroring the tsconfig `@/*` → `./*`, so `import x from '@/src/...'` works identically in tests and in Next.)

- [ ] **Step 5: Run it and watch it PASS, then delete the smoke test.**
  ```bash
  npx vitest run src/lib/__smoke.test.ts
  ```
  EXPECT: PASS — `1 passed (1 test)`.
  Then remove the temporary file:
  ```bash
  rm src/lib/__smoke.test.ts && rmdir src/lib src 2>/dev/null; echo "cleaned"
  ```
  EXPECT output: `cleaned`

- [ ] **Step 6: Commit.**
  ```bash
  git add vitest.config.ts vitest.setup.ts && git commit -m "chore: configure vitest (jsdom + jest-dom + @/* alias)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.4: PostCSS, Tailwind theme tokens, and `app/globals.css` (spec §9.2)

**Files:**
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/globals.css`

This task is infra (Tailwind tokens/CSS); it is verified by compiling the CSS with the Tailwind CLI and asserting the contracted token values appear in the output.

- [ ] **Step 1: Write `postcss.config.mjs`.**
  Create `postcss.config.mjs`:
  ```js
  export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  };
  ```

- [ ] **Step 2: Write `tailwind.config.ts` with the EXACT spec §9.2 theme extension.**
  Create `tailwind.config.ts`:
  ```ts
  import type { Config } from 'tailwindcss';

  const config: Config = {
    content: [
      './app/**/*.{ts,tsx}',
      './components/**/*.{ts,tsx}',
      './src/**/*.{ts,tsx}',
    ],
    theme: {
      extend: {
        colors: {
          coral: { DEFAULT: '#EE5B3C', press: '#D94E30', tint: 'rgb(238 91 60 / 0.12)' },
          teal: { DEFAULT: '#4F8A86', tint: 'rgb(79 138 134 / 0.14)' },
          ink: { DEFAULT: '#6E5544', muted: 'rgb(110 85 68 / 0.64)', faint: 'rgb(110 85 68 / 0.38)' },
          paper: '#F5EEE1',
          card: '#FBF7EF',
          sun: { DEFAULT: '#F2C879', tint: 'rgb(242 200 121 / 0.22)' },
          line: 'rgb(110 85 68 / 0.12)',
          success: '#3E8E6E',
          danger: '#C2452E',
        },
        borderRadius: { card: '16px', sheet: '24px', chip: '999px', control: '12px' },
        boxShadow: {
          card: '0 2px 8px rgb(110 85 68 / 0.08)',
          lift: '0 8px 24px rgb(110 85 68 / 0.14)',
          inset: 'inset 0 0 0 1px rgb(110 85 68 / 0.06)',
        },
        fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
        fontSize: {
          display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
          title: ['22px', { lineHeight: '28px', fontWeight: '700' }],
          heading: ['18px', { lineHeight: '24px', fontWeight: '600' }],
          body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
          label: ['14px', { lineHeight: '20px', fontWeight: '500' }],
          caption: ['13px', { lineHeight: '18px', fontWeight: '500' }],
          micro: ['11px', { lineHeight: '14px', fontWeight: '600' }],
        },
        backgroundImage: {
          'cover-gradient': 'linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)',
        },
      },
    },
    plugins: [],
  };

  export default config;
  ```
  (`success`/`danger` are the §9.1 derived state colors used by Delete/“Been” affordances later; the `cover-gradient` is the canonical Sun→Coral cover from §3.1/§9.5; the `fontSize` scale is §9.3. `fontFamily.sans` resolves `var(--font-sans)`, which is defined on `:root` in `app/globals.css` below.)

- [ ] **Step 3: Write `app/globals.css` with Tailwind layers + CSS-variable tokens on `:root`.**
  Create `app/globals.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  :root {
    /* Brand palette — spec §9.1 */
    --coral: #EE5B3C;
    --coral-press: #D94E30;
    --coral-tint: rgb(238 91 60 / 0.12);
    --teal: #4F8A86;
    --teal-tint: rgb(79 138 134 / 0.14);
    --ink: #6E5544;
    --ink-muted: rgb(110 85 68 / 0.64);
    --ink-faint: rgb(110 85 68 / 0.38);
    --paper: #F5EEE1;
    --card: #FBF7EF;
    --sun: #F2C879;
    --sun-tint: rgb(242 200 121 / 0.22);
    --line: rgb(110 85 68 / 0.12);

    /* Derived states — spec §9.1 */
    --success: #3E8E6E;
    --danger: #C2452E;
    --scrim: rgb(110 85 68 / 0.45);
    --map-dim: rgb(245 238 225 / 0.70);

    /* Canonical cover gradient — spec §3.1 / §9.5 */
    --cover-gradient: linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%);

    /* Font stack — `--font-inter`/`--font-noto-sc` are wired by next/font in the
       root layout (a later group). Tailwind `fontFamily.sans` resolves this var. */
    --font-sans: var(--font-inter), var(--font-noto-sc), system-ui, sans-serif;
  }

  html,
  body {
    background-color: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans, system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
  }

  /* Budget totals + travel times align with tabular figures — spec §9.3 */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
  ```

- [ ] **Step 4: Verify Tailwind compiles the tokens.**
  Compile globals.css with a tiny throwaway content probe so the relevant utilities are emitted, and assert the token hexes appear:
  ```bash
  printf '<div class="bg-coral text-ink rounded-card shadow-card bg-cover-gradient"></div>' > /tmp/bg-probe.html && npx tailwindcss -c tailwind.config.ts -i app/globals.css -o /tmp/bg-out.css --content /tmp/bg-probe.html 2>/dev/null && grep -q "#EE5B3C" /tmp/bg-out.css && grep -q "16px" /tmp/bg-out.css && grep -q "0 2px 8px" /tmp/bg-out.css && grep -q "linear-gradient(135deg" /tmp/bg-out.css && echo "TAILWIND TOKENS OK"
  ```
  EXPECT output: `TAILWIND TOKENS OK` (Coral hex, 16px card radius, the card shadow, and the cover gradient all compiled).
  Clean up: `rm -f /tmp/bg-probe.html /tmp/bg-out.css`

- [ ] **Step 5: Commit.**
  ```bash
  git add postcss.config.mjs tailwind.config.ts app/globals.css && git commit -m "feat: tailwind theme tokens, postcss, and globals.css per spec §9.2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.5: `next.config` (standalone output + `@serwist/next` wrapping)

**Files:**
- Create: `next.config.ts`

This is infra (build config). The `app/sw.ts` Serwist source itself is owned by the PWA group; here we only wire the wrapper so `next build` emits `public/sw.js` and produces a standalone server. Verified by typechecking the config and asserting its shape via a tiny Node import probe.

- [ ] **Step 1: Write `next.config.ts`.**
  Create `next.config.ts`:
  ```ts
  import type { NextConfig } from 'next';
  import withSerwistInit from '@serwist/next';

  const withSerwist = withSerwistInit({
    // Serwist injectManifest source compiled to public/sw.js — implemented by the PWA group.
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
    // Disable the SW in dev so the offline cache never masks fresh code while developing.
    disable: process.env.NODE_ENV === 'development',
  });

  const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    eslint: {
      // Lint is run explicitly via `npm run lint`; don't fail the standalone build on it.
      ignoreDuringBuilds: true,
    },
    serverExternalPackages: ['better-sqlite3'],
  };

  export default withSerwist(nextConfig);
  ```
  (`output: 'standalone'` and the `@serwist/next` wrap are both required by the build/Docker contract; `serverExternalPackages: ['better-sqlite3']` keeps the native sqlite module out of the bundle so the standalone server can `require` it.)

- [ ] **Step 2: Typecheck the config.**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  EXPECT: PASS — no output, exit code 0.

- [ ] **Step 3: Verify the config loads and exposes the standalone + Serwist wiring.**
  Confirm Next can resolve `@serwist/next` and that the wrapped config sets `output: 'standalone'`:
  ```bash
  node --input-type=module -e "import('@serwist/next').then(m => { if (typeof m.default !== 'function') throw new Error('withSerwistInit missing'); console.log('SERWIST WRAP OK'); })"
  ```
  EXPECT output: `SERWIST WRAP OK`

- [ ] **Step 4: Commit.**
  ```bash
  git add next.config.ts && git commit -m "chore: next.config standalone output + @serwist/next wrap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.6: `src/lib/clock.ts` — `now()` and `src/db/ids.ts` — `newId()`

**Files:**
- Create: `src/lib/clock.ts`
- Create: `src/lib/clock.test.ts`
- Create: `src/db/ids.ts`
- Create: `src/db/ids.test.ts`

- [ ] **Step 1: Write the failing test for `clock.ts`.**
  Create `src/lib/clock.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { now } from '@/src/lib/clock';

  describe('now', () => {
    it('returns the current epoch in milliseconds as an integer', () => {
      const before = Date.now();
      const t = now();
      const after = Date.now();
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(before);
      expect(t).toBeLessThanOrEqual(after);
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/clock.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/clock"` (file does not exist yet).

- [ ] **Step 3: Implement `clock.ts`.**
  Create `src/lib/clock.ts`:
  ```ts
  /**
   * Current time as a Unix epoch in **milliseconds**.
   * Single source of "now" so tests can mock the clock in one place.
   */
  export function now(): number {
    return Date.now();
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/clock.test.ts
  ```
  EXPECT: PASS — `1 passed (1 test)`.

- [ ] **Step 5: Write the failing test for `ids.ts`.**
  Create `src/db/ids.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { newId } from '@/src/db/ids';

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  describe('newId', () => {
    it('returns a v4 UUID string', () => {
      const id = newId();
      expect(typeof id).toBe('string');
      expect(id).toMatch(UUID_V4);
    });

    it('returns a fresh, unique id each call', () => {
      const ids = new Set(Array.from({ length: 1000 }, () => newId()));
      expect(ids.size).toBe(1000);
    });
  });
  ```

- [ ] **Step 6: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/db/ids.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/db/ids"`.

- [ ] **Step 7: Implement `ids.ts`.**
  Create `src/db/ids.ts`:
  ```ts
  /**
   * Generate a stable text primary key for any row (UUID v4).
   * Used for every `text('id').primaryKey()` column across the schema.
   */
  export function newId(): string {
    return crypto.randomUUID();
  }
  ```

- [ ] **Step 8: Run it and watch it PASS.**
  ```bash
  npx vitest run src/db/ids.test.ts
  ```
  EXPECT: PASS — `2 passed (2 tests)`.

- [ ] **Step 9: Commit.**
  ```bash
  git add src/lib/clock.ts src/lib/clock.test.ts src/db/ids.ts src/db/ids.test.ts && git commit -m "feat: clock now() and ids newId() helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.7: `src/env.ts` — zod-validated env with test-safe defaults

**Files:**
- Create: `src/env.ts`
- Create: `src/env.test.ts`

Contract: `DATABASE_PATH`, `UPLOADS_DIR`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY` (optional in 1A dev), `DEFAULT_CURRENCY` (default `USD`), `DEFAULT_LANGUAGE` (default `en`), `TZ` (default `UTC`). Provide test-safe defaults.

- [ ] **Step 1: Write the failing test.**
  Create `src/env.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { parseEnv } from '@/src/env';

  describe('parseEnv', () => {
    it('applies test-safe defaults when nothing is provided', () => {
      const env = parseEnv({});
      expect(env.DATABASE_PATH).toBe('./burgergo.db');
      expect(env.UPLOADS_DIR).toBe('./uploads');
      expect(env.DEFAULT_CURRENCY).toBe('USD');
      expect(env.DEFAULT_LANGUAGE).toBe('en');
      expect(env.TZ).toBe('UTC');
      expect(env.GOOGLE_MAPS_SERVER_KEY).toBeUndefined();
      expect(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).toBe('');
    });

    it('reads provided values', () => {
      const env = parseEnv({
        DATABASE_PATH: '/data/app.db',
        UPLOADS_DIR: '/data/uploads',
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'browser-key',
        GOOGLE_MAPS_SERVER_KEY: 'server-key',
        DEFAULT_CURRENCY: 'JPY',
        DEFAULT_LANGUAGE: 'zh',
        TZ: 'Asia/Tokyo',
      });
      expect(env.DATABASE_PATH).toBe('/data/app.db');
      expect(env.UPLOADS_DIR).toBe('/data/uploads');
      expect(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).toBe('browser-key');
      expect(env.GOOGLE_MAPS_SERVER_KEY).toBe('server-key');
      expect(env.DEFAULT_CURRENCY).toBe('JPY');
      expect(env.DEFAULT_LANGUAGE).toBe('zh');
      expect(env.TZ).toBe('Asia/Tokyo');
    });

    it('rejects an invalid DEFAULT_LANGUAGE', () => {
      expect(() => parseEnv({ DEFAULT_LANGUAGE: 'fr' })).toThrow();
    });

    it('uppercases and rejects a malformed DEFAULT_CURRENCY', () => {
      expect(parseEnv({ DEFAULT_CURRENCY: 'usd' }).DEFAULT_CURRENCY).toBe('USD');
      expect(() => parseEnv({ DEFAULT_CURRENCY: 'US' })).toThrow();
    });

    it('exposes a ready-to-use singleton `env`', async () => {
      const mod = await import('@/src/env');
      expect(typeof mod.env.DATABASE_PATH).toBe('string');
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/env.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/env"`.

- [ ] **Step 3: Implement `env.ts`.**
  Create `src/env.ts`:
  ```ts
  import { z } from 'zod';

  /**
   * Environment schema (spec §8.6). Required keys fail fast at boot;
   * `GOOGLE_MAPS_SERVER_KEY` is optional in 1A dev. Defaults are test-safe
   * so unit tests and CI run with zero env configured.
   */
  const envSchema = z.object({
    DATABASE_PATH: z.string().min(1).default('./burgergo.db'),
    UPLOADS_DIR: z.string().min(1).default('./uploads'),
    // Browser key is inherently public; empty string is acceptable in 1A dev.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().default(''),
    // Server key optional in 1A dev (no Google proxy routes yet).
    GOOGLE_MAPS_SERVER_KEY: z.string().min(1).optional(),
    DEFAULT_CURRENCY: z
      .string()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO-4217 code'))
      .default('USD'),
    DEFAULT_LANGUAGE: z.enum(['en', 'zh']).default('en'),
    TZ: z.string().min(1).default('UTC'),
  });

  export type Env = z.infer<typeof envSchema>;

  /**
   * Parse + validate a raw env-like record. Throws a readable error on
   * invalid input. Exported (rather than only the singleton) so tests can
   * inject controlled inputs.
   */
  export function parseEnv(raw: Record<string, string | undefined>): Env {
    const result = envSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    return result.data;
  }

  /** Validated process env, ready to import everywhere. Fails fast at boot. */
  export const env: Env = parseEnv(process.env as Record<string, string | undefined>);
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/env.test.ts
  ```
  EXPECT: PASS — `5 passed (5 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/env.ts src/env.test.ts && git commit -m "feat: zod-validated env module with test-safe defaults

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.8: `src/lib/currency.ts` — ISO-4217 exponent map + `formatMoney`

**Files:**
- Create: `src/lib/currency.ts`
- Create: `src/lib/currency.test.ts`

Contract: ISO-4217 exponent map (JPY=0, USD/CNY/EUR=2, KWD=3, default 2); `formatMoney(minorUnits, currency, locale)` → string. Stored money is integer minor units; the exponent converts minor→major (§5.1, §4.4).

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/currency.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { currencyExponent, formatMoney } from '@/src/lib/currency';

  describe('currencyExponent', () => {
    it('maps known currencies to their ISO-4217 minor-unit exponent', () => {
      expect(currencyExponent('JPY')).toBe(0);
      expect(currencyExponent('USD')).toBe(2);
      expect(currencyExponent('CNY')).toBe(2);
      expect(currencyExponent('EUR')).toBe(2);
      expect(currencyExponent('KWD')).toBe(3);
    });

    it('is case-insensitive on the ISO code', () => {
      expect(currencyExponent('jpy')).toBe(0);
      expect(currencyExponent('kwd')).toBe(3);
    });

    it('defaults unknown currencies to exponent 2', () => {
      expect(currencyExponent('ZZZ')).toBe(2);
    });
  });

  describe('formatMoney', () => {
    it('formats USD minor units (cents) as 2-decimal major units', () => {
      // 123456 cents = $1,234.56
      expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    });

    it('formats JPY with zero decimals (whole yen)', () => {
      // 1500 yen = ¥1,500 (exponent 0 → no division)
      expect(formatMoney(1500, 'JPY', 'en-US')).toBe('¥1,500');
    });

    it('formats KWD with three decimals', () => {
      // 1234567 fils = 1,234.567 KWD
      const out = formatMoney(1234567, 'KWD', 'en-US');
      expect(out).toContain('1,234.567');
    });

    it('formats CNY in a zh-CN locale', () => {
      // 9900 fen = ¥99.00
      expect(formatMoney(9900, 'CNY', 'zh-CN')).toBe('¥99.00');
    });

    it('handles zero and negative amounts', () => {
      expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
      expect(formatMoney(-500, 'USD', 'en-US')).toBe('-$5.00');
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/currency.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/currency"`.

- [ ] **Step 3: Implement `currency.ts`.**
  Create `src/lib/currency.ts`:
  ```ts
  /**
   * ISO-4217 decimal exponents (spec §5.1 / §4.4). Money is stored as integer
   * minor units; the exponent converts minor → major for display.
   * Default for any currency not listed here is 2.
   */
  const EXPONENTS: Record<string, number> = {
    JPY: 0,
    KRW: 0,
    VND: 0,
    USD: 2,
    CNY: 2,
    EUR: 2,
    GBP: 2,
    KWD: 3,
    BHD: 3,
    JOD: 3,
  };

  const DEFAULT_EXPONENT = 2;

  /** Minor-unit exponent for an ISO-4217 code (case-insensitive); default 2. */
  export function currencyExponent(currency: string): number {
    const code = currency.toUpperCase();
    return EXPONENTS[code] ?? DEFAULT_EXPONENT;
  }

  /**
   * Render integer `minorUnits` of `currency` as a localized string.
   * The minor→major conversion uses the ISO exponent; Intl.NumberFormat
   * supplies the symbol and grouping for the active `locale`.
   */
  export function formatMoney(minorUnits: number, currency: string, locale: string): string {
    const code = currency.toUpperCase();
    const exponent = currencyExponent(code);
    const major = minorUnits / 10 ** exponent;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(major);
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/currency.test.ts
  ```
  EXPECT: PASS — `9 passed (9 tests)`. (If a Node ICU build renders a non-breaking space or a different symbol, adjust the expected strings to the actual `Intl` output for this Node 22 runtime; the exponent-driven values — `1,234.56`, `1,500`, `1,234.567` — are the load-bearing assertions.)

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/currency.ts src/lib/currency.test.ts && git commit -m "feat: currency exponent map + formatMoney (spec §5.1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.9: `src/lib/googleMapsUrl.ts` — `placeUrl` + `dayRouteUrl` (spec §6.4)

**Files:**
- Create: `src/lib/googleMapsUrl.ts`
- Create: `src/lib/googleMapsUrl.test.ts`

Contract: `placeUrl({name,lat,lng,googlePlaceId})` and `dayRouteUrl(orderedPlaces, mode)` with enum→param mapping `walk→walking / drive→driving / transit→transit`, using Google Maps Universal URLs (§6.4). Single place: prefer `googlePlaceId`, fall back to coords. Multi-stop: origin = first, destination = last, intermediate as pipe-separated `waypoints`, plus `travelmode`.

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/googleMapsUrl.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { placeUrl, dayRouteUrl } from '@/src/lib/googleMapsUrl';
  import type { TravelMode } from '@/src/lib/googleMapsUrl';

  describe('placeUrl', () => {
    it('uses query + query_place_id when a googlePlaceId is present', () => {
      const url = placeUrl({
        name: 'Senso-ji Temple',
        lat: 35.714765,
        lng: 139.796655,
        googlePlaceId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw',
      });
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
      expect(u.searchParams.get('api')).toBe('1');
      expect(u.searchParams.get('query')).toBe('Senso-ji Temple');
      expect(u.searchParams.get('query_place_id')).toBe('ChIJ8T1GpMGOGGARDYGSgpooDWw');
    });

    it('falls back to coordinates as the query when googlePlaceId is null', () => {
      const url = placeUrl({
        name: 'Dropped pin',
        lat: 35.714765,
        lng: 139.796655,
        googlePlaceId: null,
      });
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
      expect(u.searchParams.get('query')).toBe('35.714765,139.796655');
      expect(u.searchParams.has('query_place_id')).toBe(false);
    });

    it('uses coordinates when googlePlaceId is undefined', () => {
      const url = placeUrl({ name: 'X', lat: 1, lng: 2 });
      expect(new URL(url).searchParams.get('query')).toBe('1,2');
    });
  });

  describe('dayRouteUrl', () => {
    const places = [
      { lat: 35.6586, lng: 139.7454 },
      { lat: 35.6595, lng: 139.7005 },
      { lat: 35.6764, lng: 139.6993 },
      { lat: 35.7148, lng: 139.7967 },
    ];

    it('builds an origin/destination/waypoints directions URL with mapped mode', () => {
      const url = dayRouteUrl(places, 'transit');
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
      expect(u.searchParams.get('api')).toBe('1');
      expect(u.searchParams.get('origin')).toBe('35.6586,139.7454');
      expect(u.searchParams.get('destination')).toBe('35.7148,139.7967');
      expect(u.searchParams.get('waypoints')).toBe('35.6595,139.7005|35.6764,139.6993');
      expect(u.searchParams.get('travelmode')).toBe('transit');
    });

    it('maps walk → walking and drive → driving', () => {
      expect(new URL(dayRouteUrl(places, 'walk')).searchParams.get('travelmode')).toBe('walking');
      expect(new URL(dayRouteUrl(places, 'drive')).searchParams.get('travelmode')).toBe('driving');
    });

    it('omits waypoints for a 2-stop day', () => {
      const url = dayRouteUrl([places[0]!, places[3]!], 'drive');
      const u = new URL(url);
      expect(u.searchParams.get('origin')).toBe('35.6586,139.7454');
      expect(u.searchParams.get('destination')).toBe('35.7148,139.7967');
      expect(u.searchParams.has('waypoints')).toBe(false);
    });

    it('for a single stop, origin equals destination and no waypoints', () => {
      const u = new URL(dayRouteUrl([places[0]!], 'walk'));
      expect(u.searchParams.get('origin')).toBe('35.6586,139.7454');
      expect(u.searchParams.get('destination')).toBe('35.6586,139.7454');
      expect(u.searchParams.has('waypoints')).toBe(false);
    });

    it('throws when given no stops', () => {
      expect(() => dayRouteUrl([], 'walk' as TravelMode)).toThrow();
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/googleMapsUrl.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/googleMapsUrl"`.

- [ ] **Step 3: Implement `googleMapsUrl.ts`.**
  Create `src/lib/googleMapsUrl.ts`:
  ```ts
  /**
   * Google Maps Universal URL builders (spec §6.4). These are plain URLs —
   * no API call, no key, constructible **offline** from cached `places` rows.
   * Tapping one hands off to the native Google Maps app.
   */

  /** Internal per-day travel mode (matches `travel_legs.mode`). */
  export type TravelMode = 'walk' | 'drive' | 'transit';

  /** Explicit enum → Google `travelmode` param mapping (never pass the raw enum). */
  const MODE_PARAM: Record<TravelMode, string> = {
    walk: 'walking',
    drive: 'driving',
    transit: 'transit',
  };

  export interface PlaceUrlInput {
    name: string;
    lat: number;
    lng: number;
    /** Prefer this exact-POI id; null/undefined → fall back to coords. */
    googlePlaceId?: string | null;
  }

  /** A latitude/longitude pair, as stored on a `places` row. */
  export interface LatLng {
    lat: number;
    lng: number;
  }

  function coordStr(p: LatLng): string {
    return `${p.lat},${p.lng}`;
  }

  /**
   * "Open in Google Maps" for a single place. Prefers `googlePlaceId`
   * (exact POI, human-readable `query` label); falls back to coordinates
   * for map-drop pins that lack a place id.
   */
  export function placeUrl(input: PlaceUrlInput): string {
    const params = new URLSearchParams({ api: '1' });
    if (input.googlePlaceId) {
      params.set('query', input.name);
      params.set('query_place_id', input.googlePlaceId);
    } else {
      params.set('query', coordStr(input));
    }
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  /**
   * Multi-stop day-route deep link. Origin = first stop, destination = last
   * stop, intermediate stops as ordered pipe-separated `waypoints`, plus the
   * day's `travelmode`. Coordinates come straight from cached `places` rows in
   * `order_index` sequence, so the link is constructible offline.
   */
  export function dayRouteUrl(orderedPlaces: LatLng[], mode: TravelMode): string {
    if (orderedPlaces.length === 0) {
      throw new Error('dayRouteUrl requires at least one stop');
    }
    const first = orderedPlaces[0]!;
    const last = orderedPlaces[orderedPlaces.length - 1]!;
    const intermediate = orderedPlaces.slice(1, -1);

    const params = new URLSearchParams({
      api: '1',
      origin: coordStr(first),
      destination: coordStr(last),
      travelmode: MODE_PARAM[mode],
    });
    if (intermediate.length > 0) {
      params.set('waypoints', intermediate.map(coordStr).join('|'));
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  ```
  Note: `URLSearchParams` percent-encodes the space in `"Senso-ji Temple"` and the `|` separator on serialization; the test reads them back via `URL`/`searchParams.get`, which decode automatically, so the asserted decoded values hold.

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/googleMapsUrl.test.ts
  ```
  EXPECT: PASS — `8 passed (8 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/googleMapsUrl.ts src/lib/googleMapsUrl.test.ts && git commit -m "feat: google maps universal URL builders (spec §6.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.10: `src/lib/days.ts` — `deriveDays` + `tripStatus` (TZ-aware)

**Files:**
- Create: `src/lib/days.ts`
- Create: `src/lib/days.test.ts`

Contract: `deriveDays(trip, tz)` → `Array<{ date:'YYYY-MM-DD', dayNumber:number, weekday:string, isToday:boolean }>` spanning `startDate..endDate` inclusive; `tripStatus(trip, tz)` → `'upcoming' | 'active' | 'past'`. Both take exactly two args and read the system clock internally for "today" (tests freeze it with `vi.useFakeTimers()` + `vi.setSystemTime(...)`); "today" is resolved TZ-aware via `Intl` with `timeZone` (§3.8, canonical conventions). Days are derived, not stored (§5.4).

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/days.test.ts`:
  ```ts
  import { describe, it, expect, vi, afterEach } from 'vitest';
  import { deriveDays, tripStatus } from '@/src/lib/days';

  /** Minimal trip shape consumed by the day helpers. */
  const trip = (startDate: string, endDate: string) => ({ startDate, endDate });

  /** Freeze wall-clock time to a fixed UTC instant for deterministic "today". */
  function freezeUtc(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('deriveDays', () => {
    it('expands an inclusive date range into ordered days', () => {
      const days = deriveDays(trip('2026-05-03', '2026-05-05'), 'UTC');
      expect(days.map((d) => d.date)).toEqual(['2026-05-03', '2026-05-04', '2026-05-05']);
      expect(days.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
    });

    it('returns a single day when start === end', () => {
      const days = deriveDays(trip('2026-06-05', '2026-06-05'), 'UTC');
      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({ date: '2026-06-05', dayNumber: 1 });
    });

    it('crosses month and year boundaries correctly', () => {
      const days = deriveDays(trip('2026-12-30', '2027-01-02'), 'UTC');
      expect(days.map((d) => d.date)).toEqual([
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
        '2027-01-02',
      ]);
      expect(days.at(-1)!.dayNumber).toBe(4);
    });

    it('labels weekday names', () => {
      // 2026-05-03 is a Sunday.
      const days = deriveDays(trip('2026-05-03', '2026-05-04'), 'UTC');
      expect(days[0]!.weekday).toBe('Sunday');
      expect(days[1]!.weekday).toBe('Monday');
    });

    it('flags isToday using the container timezone', () => {
      // 2026-06-05T20:00Z is 2026-06-06 in Asia/Tokyo (+09:00).
      freezeUtc('2026-06-05T20:00:00Z');
      const days = deriveDays(trip('2026-06-04', '2026-06-07'), 'Asia/Tokyo');
      const today = days.find((d) => d.isToday);
      expect(today?.date).toBe('2026-06-06');
      // Same instant in UTC is still June 5.
      const daysUtc = deriveDays(trip('2026-06-04', '2026-06-07'), 'UTC');
      expect(daysUtc.find((d) => d.isToday)?.date).toBe('2026-06-05');
    });

    it('marks no day as today when today is outside the range', () => {
      freezeUtc('2026-01-01T12:00:00Z');
      const days = deriveDays(trip('2026-06-04', '2026-06-07'), 'UTC');
      expect(days.some((d) => d.isToday)).toBe(false);
    });
  });

  describe('tripStatus', () => {
    it('is upcoming when today is before the start date', () => {
      freezeUtc('2026-06-01T12:00:00Z');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('upcoming');
    });

    it('is active when today is within the inclusive range', () => {
      freezeUtc('2026-06-05T12:00:00Z');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('active');
    });

    it('is active on the boundary days (inclusive)', () => {
      freezeUtc('2026-06-04T12:00:00Z');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('active');
      freezeUtc('2026-06-07T12:00:00Z');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('active');
    });

    it('is past when today is after the end date', () => {
      freezeUtc('2026-06-08T12:00:00Z');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('past');
    });

    it('respects the container timezone at the day boundary', () => {
      // 2026-06-03T23:00Z is 2026-06-04 in Asia/Tokyo → active on a trip starting 06-04.
      freezeUtc('2026-06-03T23:00:00Z');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'Asia/Tokyo')).toBe('active');
      expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('upcoming');
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/days.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/days"`.

- [ ] **Step 3: Implement `days.ts`.**
  Create `src/lib/days.ts`:
  ```ts
  /**
   * Day derivation + trip status (spec §5.4, §3.8). Days are computed from
   * `start_date`/`end_date` rather than stored. "Today" is read from the
   * system clock and resolved in the container timezone via `Intl` so the
   * server redirect and the client day strip never disagree on the active day.
   * Both helpers take exactly (trip, tz) — no injected `now` — so tests freeze
   * time with `vi.useFakeTimers()` + `vi.setSystemTime(...)`.
   */

  /** Minimal trip shape needed for day math (calendar-date strings). */
  export interface TripDates {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
  }

  export interface DerivedDay {
    date: string; // YYYY-MM-DD
    dayNumber: number; // 1-based: Day 1 = startDate
    weekday: string; // e.g. "Sunday" (locale-independent English long name)
    isToday: boolean;
  }

  export type TripStatus = 'upcoming' | 'active' | 'past';

  /** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
  function todayInTz(tz: string): string {
    // 'en-CA' yields ISO YYYY-MM-DD; timeZone shifts the wall date into `tz`.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /** English long weekday for a calendar date string (timezone-stable via UTC). */
  function weekdayOf(dateStr: string): string {
    // Parse as a UTC midnight so the weekday never shifts with the host TZ.
    const d = new Date(`${dateStr}T00:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(d);
  }

  /** Advance a YYYY-MM-DD string by one calendar day (UTC arithmetic). */
  function nextDate(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Expand `[startDate, endDate]` (inclusive) into an ordered day list with
   * 1-based numbers, English weekday names, and a TZ-aware `isToday` flag.
   */
  export function deriveDays(trip: TripDates, tz: string): DerivedDay[] {
    const today = todayInTz(tz);
    const days: DerivedDay[] = [];
    let cursor = trip.startDate;
    let n = 1;
    // Lexicographic comparison is valid for zero-padded YYYY-MM-DD strings.
    while (cursor <= trip.endDate) {
      days.push({
        date: cursor,
        dayNumber: n,
        weekday: weekdayOf(cursor),
        isToday: cursor === today,
      });
      cursor = nextDate(cursor);
      n += 1;
    }
    return days;
  }

  /**
   * 'upcoming' if today < startDate, 'past' if today > endDate, else 'active'
   * (boundaries inclusive). Today is resolved in the container `tz`.
   */
  export function tripStatus(trip: TripDates, tz: string): TripStatus {
    const today = todayInTz(tz);
    if (today < trip.startDate) return 'upcoming';
    if (today > trip.endDate) return 'past';
    return 'active';
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/days.test.ts
  ```
  EXPECT: PASS — `12 passed (12 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/days.ts src/lib/days.test.ts && git commit -m "feat: deriveDays + tripStatus (TZ-aware, spec §5.4/§3.8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A0.11: Group gate — full suite + typecheck green

**Files:**
- No new source files. This task verifies the whole A0 group runs cleanly via the contracted `npm test` script and the strict typecheck, so later groups can build on a known-green base.

- [ ] **Step 1: Run the full Vitest suite via the contracted script.**
  ```bash
  npm test
  ```
  EXPECT: PASS — every A0 test file (`clock`, `ids`, `env`, `currency`, `googleMapsUrl`, `days`) reported, `0 failed`. Concretely: 6 test files, 36 tests passed (5 env + 2 ids + 9 currency + 8 googleMapsUrl + 12 days... `clock` adds 1 → 37 tests across 6 files). The exact total may shift if you split assertions; the load-bearing check is **0 failures**.

- [ ] **Step 2: Run the strict typecheck across the whole project.**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  EXPECT: PASS — no output, exit code 0 (strict mode + `noUncheckedIndexedAccess` clean across every lib, test, and config file).

- [ ] **Step 3: Commit a marker confirming the gate (no-op tree change is unnecessary; commit only if Step 1/2 required a fix).**
  If Steps 1–2 were already green with no edits, skip the commit. If any fix was needed, stage it and:
  ```bash
  git add -A && git commit -m "test: green A0 gate — full vitest suite + strict typecheck pass

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.1: Drizzle schema for all Phase-1 tables

**Files:**
- Create: `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

This is the single source of truth for all five required Phase-1 tables (`trips`, `places`, `place_details_cache`, `travel_legs`, `settings`) plus Drizzle `relations()`. The schema is pure data — its "test" asserts the table objects expose the contracted columns/enums so a later migration can't silently drift from spec §5.8.

- [ ] **Step 1: Write the failing schema test.**
  Create `src/db/schema.test.ts` with the full contents below. It imports the (not-yet-existing) schema and asserts every contracted column name, enum, and the `settings` integer PK exist via Drizzle's runtime column metadata.

  ```ts
  import { describe, it, expect } from 'vitest';
  import { getTableColumns } from 'drizzle-orm';
  import {
    trips,
    places,
    travelLegs,
    placeDetailsCache,
    settings,
  } from '@/src/db/schema';

  describe('schema: trips', () => {
    it('exposes the spec §5.2 columns', () => {
      const cols = getTableColumns(trips);
      expect(Object.keys(cols).sort()).toEqual(
        ['coverPhoto', 'createdAt', 'endDate', 'id', 'name', 'startDate', 'updatedAt'].sort(),
      );
      expect(cols.id.primary).toBe(true);
      expect(cols.name.notNull).toBe(true);
      expect(cols.startDate.notNull).toBe(true);
      expect(cols.endDate.notNull).toBe(true);
      expect(cols.coverPhoto.notNull).toBe(false);
    });
  });

  describe('schema: places', () => {
    it('exposes the spec §5.2 columns incl. nullable dayDate/googlePlaceId', () => {
      const cols = getTableColumns(places);
      expect(cols.dayDate.notNull).toBe(false);
      expect(cols.googlePlaceId.notNull).toBe(false);
      expect(cols.orderIndex.notNull).toBe(true);
      expect(cols.category.notNull).toBe(true);
    });
    it('category enum matches the spec', () => {
      expect(places.category.enumValues).toEqual([
        'sightseeing',
        'lodging',
        'transport',
        'activity',
        'other',
      ]);
    });
  });

  describe('schema: travelLegs', () => {
    it('mode enum is walk|drive|transit and metrics are notNull', () => {
      expect(travelLegs.mode.enumValues).toEqual(['walk', 'drive', 'transit']);
      const cols = getTableColumns(travelLegs);
      expect(cols.durationSeconds.notNull).toBe(true);
      expect(cols.distanceMeters.notNull).toBe(true);
    });
  });

  describe('schema: placeDetailsCache', () => {
    it('is keyed by googlePlaceId', () => {
      const cols = getTableColumns(placeDetailsCache);
      expect(cols.googlePlaceId.primary).toBe(true);
      expect(cols.fetchedAt.notNull).toBe(true);
    });
  });

  describe('schema: settings', () => {
    it('has integer PK and en|zh language enum', () => {
      const cols = getTableColumns(settings);
      expect(cols.id.primary).toBe(true);
      expect(cols.id.columnType).toBe('SQLiteInteger');
      expect(settings.language.enumValues).toEqual(['en', 'zh']);
      expect(cols.currency.notNull).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run the test and watch it FAIL.**
  ```bash
  npx vitest run src/db/schema.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "@/src/db/schema"` (the file does not exist yet).

- [ ] **Step 3: Implement the schema.**
  Create `src/db/schema.ts` with the full contents below. Tables follow spec §5.8 exactly; the four deferred tables (`restaurants`, `expenses`, `journalEntries`, `savedLinks`, `photos`) are intentionally NOT added in 1A per the plan scope.

  ```ts
  import {
    sqliteTable,
    text,
    integer,
    real,
    index,
    uniqueIndex,
  } from 'drizzle-orm/sqlite-core';
  import { relations } from 'drizzle-orm';

  export const trips = sqliteTable('trips', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date').notNull(), // YYYY-MM-DD, must be >= startDate (app-validated)
    coverPhoto: text('cover_photo'), // nullable photos path reference
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  });

  export const places = sqliteTable(
    'places',
    {
      id: text('id').primaryKey(),
      tripId: text('trip_id')
        .notNull()
        .references(() => trips.id, { onDelete: 'cascade' }),
      dayDate: text('day_date'), // NULL = Saved/wishlist bucket (locked day_id)
      googlePlaceId: text('google_place_id'), // NULL for map-drop pins
      name: text('name').notNull(),
      address: text('address'),
      lat: real('lat'),
      lng: real('lng'),
      category: text('category', {
        enum: ['sightseeing', 'lodging', 'transport', 'activity', 'other'],
      }).notNull(),
      scheduledTime: text('scheduled_time'), // HH:MM
      durationMin: integer('duration_min'),
      cost: integer('cost'), // minor units, single currency
      notes: text('notes'),
      orderIndex: integer('order_index').notNull(), // 0-based; pin label = orderIndex + 1
      createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    },
    (t) => ({
      byTripDay: index('idx_places_trip_day').on(t.tripId, t.dayDate, t.orderIndex),
      byGoogle: index('idx_places_google').on(t.googlePlaceId),
    }),
  );

  export const travelLegs = sqliteTable(
    'travel_legs',
    {
      id: text('id').primaryKey(),
      tripId: text('trip_id')
        .notNull()
        .references(() => trips.id, { onDelete: 'cascade' }),
      fromPlaceId: text('from_place_id')
        .notNull()
        .references(() => places.id, { onDelete: 'cascade' }),
      toPlaceId: text('to_place_id')
        .notNull()
        .references(() => places.id, { onDelete: 'cascade' }),
      mode: text('mode', { enum: ['walk', 'drive', 'transit'] }).notNull(),
      durationSeconds: integer('duration_seconds').notNull(),
      distanceMeters: integer('distance_meters').notNull(),
      computedAt: integer('computed_at', { mode: 'timestamp' }).notNull(),
    },
    (t) => ({
      uniqLeg: uniqueIndex('uniq_leg').on(t.fromPlaceId, t.toPlaceId, t.mode),
    }),
  );

  export const placeDetailsCache = sqliteTable('place_details_cache', {
    googlePlaceId: text('google_place_id').primaryKey(),
    name: text('name'),
    address: text('address'),
    lat: real('lat'),
    lng: real('lng'),
    categoryGuess: text('category_guess'),
    photoRef: text('photo_ref'),
    photoLocalPath: text('photo_local_path'),
    rawJson: text('raw_json'),
    fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
  });

  export const settings = sqliteTable('settings', {
    id: integer('id').primaryKey(), // always 1
    language: text('language', { enum: ['en', 'zh'] }).notNull(),
    currency: text('currency').notNull(), // ISO 4217, single global currency
  });

  // Relations (groundwork; only trips/places/travelLegs participate in 1A).
  export const tripsRelations = relations(trips, ({ many }) => ({
    places: many(places),
    travelLegs: many(travelLegs),
  }));

  export const placesRelations = relations(places, ({ one, many }) => ({
    trip: one(trips, { fields: [places.tripId], references: [trips.id] }),
    legsFrom: many(travelLegs, { relationName: 'legFrom' }),
    legsTo: many(travelLegs, { relationName: 'legTo' }),
  }));

  export const travelLegsRelations = relations(travelLegs, ({ one }) => ({
    trip: one(trips, { fields: [travelLegs.tripId], references: [trips.id] }),
    fromPlace: one(places, {
      fields: [travelLegs.fromPlaceId],
      references: [places.id],
      relationName: 'legFrom',
    }),
    toPlace: one(places, {
      fields: [travelLegs.toPlaceId],
      references: [places.id],
      relationName: 'legTo',
    }),
  }));

  // Inferred row types (used by repos in later tasks).
  export type Trip = typeof trips.$inferSelect;
  export type NewTrip = typeof trips.$inferInsert;
  export type Place = typeof places.$inferSelect;
  export type TravelLeg = typeof travelLegs.$inferSelect;
  export type PlaceDetailsCacheRow = typeof placeDetailsCache.$inferSelect;
  export type NewPlaceDetailsCacheRow = typeof placeDetailsCache.$inferInsert;
  export type Settings = typeof settings.$inferSelect;
  ```

- [ ] **Step 4: Run the test and watch it PASS.**
  ```bash
  npx vitest run src/db/schema.test.ts
  ```
  Expected: PASS — all 7 assertions green (`Test Files 1 passed`, `Tests 7 passed`).

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/schema.ts src/db/schema.test.ts
  git commit -m "feat(db): add Phase-1 Drizzle schema (trips, places, place_details_cache, travel_legs, settings)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.2: drizzle.config.ts + generate & commit the initial migration

**Files:**
- Create: `drizzle.config.ts`
- Create (generated, committed): `drizzle/0000_*.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`

`drizzle-kit generate` reads the schema and emits the SQL migration that the programmatic migrator (A1.4) and Docker entrypoint apply. There is no unit test here — the migration is verified by being applied in A1.5's `makeTestDb` test. Verify now by inspecting the generated SQL.

- [ ] **Step 1: Write `drizzle.config.ts`.**
  Create `drizzle.config.ts` with the full contents below. `dialect: 'sqlite'`, schema path and output folder per the DB contract.

  ```ts
  import { defineConfig } from 'drizzle-kit';

  export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/schema.ts',
    out: './drizzle',
    strict: true,
    verbose: true,
  });
  ```

- [ ] **Step 2: Generate the migration.**
  ```bash
  npx drizzle-kit generate --name init
  ```
  Expected output: drizzle-kit prints `5 tables` and `Your SQL migration file ➜ drizzle/0000_init.sql`, creating `drizzle/0000_init.sql` plus `drizzle/meta/_journal.json` and `drizzle/meta/0000_snapshot.json`.

- [ ] **Step 3: Verify the generated SQL contains all five tables and the key indexes.**
  ```bash
  grep -E "CREATE TABLE|CREATE.*INDEX" drizzle/0000_init.sql
  ```
  Expected output (order/exact whitespace may vary) — these lines must all be present:
  ```
  CREATE TABLE `trips` (
  CREATE TABLE `places` (
  CREATE TABLE `travel_legs` (
  CREATE TABLE `place_details_cache` (
  CREATE TABLE `settings` (
  CREATE INDEX `idx_places_trip_day` ON `places` (`trip_id`,`day_date`,`order_index`);
  CREATE INDEX `idx_places_google` ON `places` (`google_place_id`);
  CREATE UNIQUE INDEX `uniq_leg` ON `travel_legs` (`from_place_id`,`to_place_id`,`mode`);
  ```

- [ ] **Step 4: Verify the FK cascade and money/timestamp column types landed.**
  ```bash
  grep -E "ON DELETE cascade|order_index. integer NOT NULL|created_at. integer NOT NULL" drizzle/0000_init.sql
  ```
  Expected output: at least one `ON DELETE cascade` line (from `places.trip_id` and the `travel_legs` FKs), the `order_index` integer NOT NULL line, and `created_at` integer NOT NULL lines. If any are missing, the schema in A1.1 is wrong — fix it and re-run generate.

- [ ] **Step 5: Commit the config and generated migration.**
  ```bash
  git add drizzle.config.ts drizzle/
  git commit -m "feat(db): drizzle.config + generate initial migration (drizzle/0000_init.sql)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.3: better-sqlite3 + Drizzle client singleton (WAL)

**Files:**
- Create: `src/db/client.ts`
- Test: `src/db/client.test.ts`

`src/db/client.ts` opens the production database at `DATABASE_PATH` (from `src/env.ts`, created in A0), enables WAL, and exports the singleton `db` (drizzle instance) and the raw `sqlite` handle. The test uses a temp DB path so it never touches a real volume.

- [ ] **Step 1: Write the failing client test.**
  Create `src/db/client.test.ts` with the full contents below. It points `DATABASE_PATH` at a temp file (set BEFORE importing the module so the singleton picks it up), then asserts WAL is on and that `db` can run a trivial query.

  ```ts
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { mkdtempSync, rmSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import { sql } from 'drizzle-orm';

  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'burgergo-client-'));
    process.env.DATABASE_PATH = join(tmpDir, 'test.db');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('db client singleton', () => {
    it('opens better-sqlite3 in WAL mode and exposes db + sqlite', async () => {
      const { db, sqlite } = await import('@/src/db/client');
      const mode = sqlite.pragma('journal_mode', { simple: true });
      expect(String(mode).toLowerCase()).toBe('wal');

      const row = db.get<{ one: number }>(sql`SELECT 1 as one`);
      expect(row.one).toBe(1);
    });

    it('returns the same instance on re-import (singleton)', async () => {
      const a = await import('@/src/db/client');
      const b = await import('@/src/db/client');
      expect(a.db).toBe(b.db);
      expect(a.sqlite).toBe(b.sqlite);
    });
  });
  ```

- [ ] **Step 2: Run the test and watch it FAIL.**
  ```bash
  npx vitest run src/db/client.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "@/src/db/client"`.

- [ ] **Step 3: Implement the client.**
  Create `src/db/client.ts` with the full contents below. It reads the validated `env.DATABASE_PATH` from A0's `src/env.ts`, ensures the parent directory exists, opens the connection once, sets WAL, and exports `db` + `sqlite`.

  ```ts
  import { mkdirSync } from 'node:fs';
  import { dirname } from 'node:path';
  import Database from 'better-sqlite3';
  import { drizzle } from 'drizzle-orm/better-sqlite3';
  import { env } from '@/src/env';
  import * as schema from '@/src/db/schema';

  // Ensure the directory for the DB file exists (first boot on a fresh volume).
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

  // Single connection — single user, single container, one writer (spec §10.5).
  export const sqlite = new Database(env.DATABASE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  export const db = drizzle(sqlite, { schema });

  export type DB = typeof db;
  ```

- [ ] **Step 4: Run the test and watch it PASS.**
  ```bash
  npx vitest run src/db/client.test.ts
  ```
  Expected: PASS — `Tests 2 passed`; journal mode reads `wal`, `SELECT 1` returns `1`, and re-import yields the same singleton.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/client.ts src/db/client.test.ts
  git commit -m "feat(db): better-sqlite3 + drizzle singleton client with WAL

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.4: Programmatic migrator (scripts/migrate.ts)

**Files:**
- Create: `scripts/migrate.ts`
- Test: `scripts/migrate.test.ts`

`scripts/migrate.ts` is what the Docker entrypoint runs before serving traffic: it opens the DB at `DATABASE_PATH`, applies `drizzle/` migrations, and seeds the single `settings` row from `DEFAULT_*`. We expose a pure `runMigrations(databasePath)` for testing, plus a CLI guard that runs it against `env.DATABASE_PATH` when executed directly.

- [ ] **Step 1: Write the failing migrator test.**
  Create `scripts/migrate.test.ts` with the full contents below. It migrates a fresh temp DB and asserts the five tables exist and the `settings` row was seeded.

  ```ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { mkdtempSync, rmSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import Database from 'better-sqlite3';
  import { runMigrations } from './migrate';

  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'burgergo-migrate-'));
    dbPath = join(tmpDir, 'm.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('runMigrations', () => {
    it('creates all five Phase-1 tables on a fresh db', () => {
      runMigrations(dbPath);
      const raw = new Database(dbPath, { readonly: true });
      const names = raw
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all()
        .map((r) => (r as { name: string }).name);
      raw.close();
      for (const t of [
        'trips',
        'places',
        'travel_legs',
        'place_details_cache',
        'settings',
      ]) {
        expect(names).toContain(t);
      }
    });

    it('seeds exactly one settings row (id=1) from defaults', () => {
      runMigrations(dbPath, { language: 'en', currency: 'USD' });
      const raw = new Database(dbPath, { readonly: true });
      const rows = raw.prepare(`SELECT id, language, currency FROM settings`).all();
      raw.close();
      expect(rows).toEqual([{ id: 1, language: 'en', currency: 'USD' }]);
    });

    it('is idempotent — re-running does not duplicate the settings row', () => {
      runMigrations(dbPath, { language: 'en', currency: 'USD' });
      runMigrations(dbPath, { language: 'zh', currency: 'CNY' });
      const raw = new Database(dbPath, { readonly: true });
      const rows = raw.prepare(`SELECT id, language, currency FROM settings`).all();
      raw.close();
      // Seed only inserts when absent; the second run is a no-op for settings.
      expect(rows).toEqual([{ id: 1, language: 'en', currency: 'USD' }]);
    });
  });
  ```

- [ ] **Step 2: Run the test and watch it FAIL.**
  ```bash
  npx vitest run scripts/migrate.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "./migrate"` (module not created yet).

- [ ] **Step 3: Implement the migrator.**
  Create `scripts/migrate.ts` with the full contents below. It applies migrations from `./drizzle` and seeds settings with `INSERT OR IGNORE` (idempotent). The CLI guard reads `env` (DATABASE_PATH + DEFAULT_* seeds) only when run directly, so importing it in tests has no side effects.

  ```ts
  import { mkdirSync } from 'node:fs';
  import { dirname, resolve } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import Database from 'better-sqlite3';
  import { drizzle } from 'drizzle-orm/better-sqlite3';
  import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

  const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

  export interface SettingsSeed {
    language: 'en' | 'zh';
    currency: string;
  }

  /**
   * Apply all pending Drizzle migrations to the SQLite file at `databasePath`,
   * then idempotently seed the single global settings row (id=1).
   * Pure and side-effect-scoped: opens, migrates, seeds, closes.
   */
  export function runMigrations(
    databasePath: string,
    seed: SettingsSeed = { language: 'en', currency: 'USD' },
  ): void {
    mkdirSync(dirname(databasePath), { recursive: true });
    const sqlite = new Database(databasePath);
    sqlite.pragma('journal_mode = WAL');
    try {
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      // Seed the single settings row only if absent (id is fixed at 1).
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO settings (id, language, currency) VALUES (1, ?, ?)`,
        )
        .run(seed.language, seed.currency);
    } finally {
      sqlite.close();
    }
  }

  // CLI entrypoint: only runs when executed directly (e.g. node scripts/migrate.js).
  const invokedDirectly =
    process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

  if (invokedDirectly) {
    // Imported lazily so test imports of runMigrations never trigger env validation.
    void import('@/src/env').then(({ env }) => {
      runMigrations(env.DATABASE_PATH, {
        language: env.DEFAULT_LANGUAGE,
        currency: env.DEFAULT_CURRENCY,
      });
      // eslint-disable-next-line no-console
      console.log(`migrations applied to ${env.DATABASE_PATH}`);
    });
  }
  ```

- [ ] **Step 4: Run the test and watch it PASS.**
  ```bash
  npx vitest run scripts/migrate.test.ts
  ```
  Expected: PASS — `Tests 3 passed`; all five tables present, settings seeded once, idempotent on re-run.

- [ ] **Step 5: Commit.**
  ```bash
  git add scripts/migrate.ts scripts/migrate.test.ts
  git commit -m "feat(db): programmatic migrator with idempotent settings seed

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.5: In-memory test DB helper (makeTestDb)

**Files:**
- Create: `src/db/testDb.ts`
- Test: `src/db/testDb.test.ts`

`makeTestDb()` is the shared helper every repo test injects: an in-memory better-sqlite3 + drizzle instance with the committed `drizzle/` migrations applied. Repos are pure (`db` is their first arg), so this is the only DB wiring tests need.

- [ ] **Step 1: Write the failing helper test.**
  Create `src/db/testDb.test.ts` with the full contents below. It builds a test DB and asserts the schema is present (a query against `trips` succeeds) and that two calls produce independent, isolated databases.

  ```ts
  import { describe, it, expect } from 'vitest';
  import { sql } from 'drizzle-orm';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips } from '@/src/db/schema';

  describe('makeTestDb', () => {
    it('returns an in-memory db with migrations applied', () => {
      const { db, sqlite } = makeTestDb();
      // Querying a migrated table must not throw.
      const rows = db.select().from(trips).all();
      expect(rows).toEqual([]);
      const mode = sqlite.pragma('journal_mode', { simple: true });
      // In-memory dbs report 'memory' journal mode.
      expect(String(mode).toLowerCase()).toBe('memory');
    });

    it('isolates state between instances', () => {
      const a = makeTestDb();
      const b = makeTestDb();
      a.sqlite
        .prepare(
          `INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at)
           VALUES ('t1', 'A', '2026-01-01', '2026-01-02', 0, 0)`,
        )
        .run();
      const aCount = a.db.get<{ c: number }>(sql`SELECT count(*) as c FROM trips`);
      const bCount = b.db.get<{ c: number }>(sql`SELECT count(*) as c FROM trips`);
      expect(aCount.c).toBe(1);
      expect(bCount.c).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run the test and watch it FAIL.**
  ```bash
  npx vitest run src/db/testDb.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "@/src/db/testDb"`.

- [ ] **Step 3: Implement the helper.**
  Create `src/db/testDb.ts` with the full contents below. It opens `:memory:`, applies the committed migrations via the drizzle migrator, and returns `{ db, sqlite }` typed with the schema.

  ```ts
  import { resolve } from 'node:path';
  import Database from 'better-sqlite3';
  import { drizzle } from 'drizzle-orm/better-sqlite3';
  import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
  import * as schema from '@/src/db/schema';

  const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

  export interface TestDb {
    db: ReturnType<typeof drizzle<typeof schema>>;
    sqlite: Database.Database;
  }

  /**
   * Build a fresh, isolated in-memory database with all committed Drizzle
   * migrations applied. Repos take `db` as their first argument, so tests pass
   * this instance directly. Foreign keys are enabled to mirror production.
   */
  export function makeTestDb(): TestDb {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return { db, sqlite };
  }
  ```

- [ ] **Step 4: Run the test and watch it PASS.**
  ```bash
  npx vitest run src/db/testDb.test.ts
  ```
  Expected: PASS — `Tests 2 passed`; the migrated in-memory DB queries cleanly and instances are isolated.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/testDb.ts src/db/testDb.test.ts
  git commit -m "test(db): add makeTestDb in-memory helper with migrations applied

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.6: Settings repo + test

**Files:**
- Create: `src/db/repos/settings.ts`
- Test: `src/db/repos/settings.test.ts`

The settings repo manages the single global config row (id=1). Contract: `getSettings(db)`, `ensureSettings(db, {language, currency})`, `updateSettings(db, patch)`. All repo fns take `db` first so tests inject `makeTestDb()`.

- [ ] **Step 1: Write the failing settings repo test.**
  Create `src/db/repos/settings.test.ts` with the full contents below.

  ```ts
  import { describe, it, expect } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import {
    getSettings,
    ensureSettings,
    updateSettings,
  } from '@/src/db/repos/settings';

  describe('settings repo', () => {
    it('getSettings returns undefined on an unseeded db', () => {
      const { db } = makeTestDb();
      expect(getSettings(db)).toBeUndefined();
    });

    it('ensureSettings inserts the id=1 row once and is idempotent', () => {
      const { db } = makeTestDb();
      const first = ensureSettings(db, { language: 'en', currency: 'USD' });
      expect(first).toEqual({ id: 1, language: 'en', currency: 'USD' });

      // Second call must NOT overwrite existing values.
      const second = ensureSettings(db, { language: 'zh', currency: 'CNY' });
      expect(second).toEqual({ id: 1, language: 'en', currency: 'USD' });

      expect(getSettings(db)).toEqual({ id: 1, language: 'en', currency: 'USD' });
    });

    it('updateSettings patches only the provided fields', () => {
      const { db } = makeTestDb();
      ensureSettings(db, { language: 'en', currency: 'USD' });

      const langOnly = updateSettings(db, { language: 'zh' });
      expect(langOnly).toEqual({ id: 1, language: 'zh', currency: 'USD' });

      const currOnly = updateSettings(db, { currency: 'JPY' });
      expect(currOnly).toEqual({ id: 1, language: 'zh', currency: 'JPY' });
    });

    it('updateSettings on an unseeded db creates the row from the patch + defaults', () => {
      const { db } = makeTestDb();
      const row = updateSettings(db, { currency: 'EUR' });
      // Falls back to language 'en' when seeding via a partial patch.
      expect(row).toEqual({ id: 1, language: 'en', currency: 'EUR' });
    });
  });
  ```

- [ ] **Step 2: Run the test and watch it FAIL.**
  ```bash
  npx vitest run src/db/repos/settings.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "@/src/db/repos/settings"`.

- [ ] **Step 3: Implement the settings repo.**
  Create `src/db/repos/settings.ts` with the full contents below. `db` is the drizzle type from `testDb`/`client`; all fns operate on the fixed id=1 row.

  ```ts
  import { eq } from 'drizzle-orm';
  import type { TestDb } from '@/src/db/testDb';
  import { settings, type Settings } from '@/src/db/schema';

  type Db = TestDb['db'];

  const SETTINGS_ID = 1;

  export interface SettingsInput {
    language: 'en' | 'zh';
    currency: string;
  }

  export type SettingsPatch = Partial<SettingsInput>;

  /** Read the single global settings row, or undefined if not yet seeded. */
  export function getSettings(db: Db): Settings | undefined {
    return db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  }

  /**
   * Insert the id=1 settings row if absent; never overwrite existing values.
   * Always returns the current row.
   */
  export function ensureSettings(db: Db, input: SettingsInput): Settings {
    const existing = getSettings(db);
    if (existing) return existing;
    db.insert(settings)
      .values({ id: SETTINGS_ID, language: input.language, currency: input.currency })
      .run();
    return getSettings(db) as Settings;
  }

  /**
   * Patch the provided fields on the id=1 row. If the row does not exist yet,
   * it is created, filling any missing field with a sensible default
   * (language 'en', currency 'USD').
   */
  export function updateSettings(db: Db, patch: SettingsPatch): Settings {
    const existing = getSettings(db);
    if (!existing) {
      return ensureSettings(db, {
        language: patch.language ?? 'en',
        currency: patch.currency ?? 'USD',
      });
    }
    const next: SettingsInput = {
      language: patch.language ?? existing.language,
      currency: patch.currency ?? existing.currency,
    };
    db.update(settings)
      .set({ language: next.language, currency: next.currency })
      .where(eq(settings.id, SETTINGS_ID))
      .run();
    return getSettings(db) as Settings;
  }
  ```

- [ ] **Step 4: Run the test and watch it PASS.**
  ```bash
  npx vitest run src/db/repos/settings.test.ts
  ```
  Expected: PASS — `Tests 4 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/settings.ts src/db/repos/settings.test.ts
  git commit -m "feat(db): settings repo (get/ensure/update single global row)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A1.7: place_details_cache repo + test

**Files:**
- Create: `src/db/repos/placeCache.ts`
- Test: `src/db/repos/placeCache.test.ts`

The place-details cache repo backs offline Google-data display. Contract: `getCachedDetails(db, googlePlaceId)`, `upsertDetails(db, row)`. Keyed by `googlePlaceId` (PK); upsert refreshes on a cache hit.

- [ ] **Step 1: Write the failing placeCache repo test.**
  Create `src/db/repos/placeCache.test.ts` with the full contents below.

  ```ts
  import { describe, it, expect } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';

  function sampleRow(overrides: Record<string, unknown> = {}) {
    return {
      googlePlaceId: 'gpid-1',
      name: 'Tokyo Tower',
      address: '4 Chome-2-8 Shibakoen, Minato City, Tokyo',
      lat: 35.6586,
      lng: 139.7454,
      categoryGuess: 'sightseeing',
      photoRef: 'photo-ref-abc',
      photoLocalPath: 'place-photos/gpid-1/card.webp',
      rawJson: '{"foo":"bar"}',
      fetchedAt: new Date(1_700_000_000_000),
      ...overrides,
    };
  }

  describe('placeCache repo', () => {
    it('getCachedDetails returns undefined on a miss', () => {
      const { db } = makeTestDb();
      expect(getCachedDetails(db, 'nope')).toBeUndefined();
    });

    it('upsertDetails inserts then reads back the row', () => {
      const { db } = makeTestDb();
      upsertDetails(db, sampleRow());
      const got = getCachedDetails(db, 'gpid-1');
      expect(got).toBeDefined();
      expect(got!.name).toBe('Tokyo Tower');
      expect(got!.lat).toBeCloseTo(35.6586, 4);
      expect(got!.photoLocalPath).toBe('place-photos/gpid-1/card.webp');
      expect(got!.fetchedAt).toEqual(new Date(1_700_000_000_000));
    });

    it('upsertDetails updates an existing row on the same googlePlaceId', () => {
      const { db, sqlite } = makeTestDb();
      upsertDetails(db, sampleRow());
      upsertDetails(
        db,
        sampleRow({
          name: 'Tokyo Tower (renamed)',
          fetchedAt: new Date(1_700_000_500_000),
        }),
      );
      const got = getCachedDetails(db, 'gpid-1');
      expect(got!.name).toBe('Tokyo Tower (renamed)');
      expect(got!.fetchedAt).toEqual(new Date(1_700_000_500_000));

      // Still exactly one row for this key.
      const { c } = sqlite.prepare('SELECT count(*) AS c FROM place_details_cache').get() as { c: number };
      expect(c).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run the test and watch it FAIL.**
  ```bash
  npx vitest run src/db/repos/placeCache.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "@/src/db/repos/placeCache"`.

- [ ] **Step 3: Implement the placeCache repo.**
  Create `src/db/repos/placeCache.ts` with the full contents below. `upsertDetails` uses Drizzle's `onConflictDoUpdate` on the `googlePlaceId` PK to refresh the cached payload.

  ```ts
  import { eq } from 'drizzle-orm';
  import type { TestDb } from '@/src/db/testDb';
  import {
    placeDetailsCache,
    type PlaceDetailsCacheRow,
    type NewPlaceDetailsCacheRow,
  } from '@/src/db/schema';

  type Db = TestDb['db'];

  /** Read a cached Place Details row by Google place id, or undefined on a miss. */
  export function getCachedDetails(
    db: Db,
    googlePlaceId: string,
  ): PlaceDetailsCacheRow | undefined {
    return db
      .select()
      .from(placeDetailsCache)
      .where(eq(placeDetailsCache.googlePlaceId, googlePlaceId))
      .get();
  }

  /**
   * Insert or refresh a cached Place Details row, keyed by googlePlaceId (PK).
   * On conflict every non-key column is overwritten with the incoming value.
   */
  export function upsertDetails(
    db: Db,
    row: NewPlaceDetailsCacheRow,
  ): PlaceDetailsCacheRow {
    db.insert(placeDetailsCache)
      .values(row)
      .onConflictDoUpdate({
        target: placeDetailsCache.googlePlaceId,
        set: {
          name: row.name ?? null,
          address: row.address ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          categoryGuess: row.categoryGuess ?? null,
          photoRef: row.photoRef ?? null,
          photoLocalPath: row.photoLocalPath ?? null,
          rawJson: row.rawJson ?? null,
          fetchedAt: row.fetchedAt,
        },
      })
      .run();
    return getCachedDetails(db, row.googlePlaceId) as PlaceDetailsCacheRow;
  }
  ```

- [ ] **Step 4: Run the test and watch it PASS.**
  ```bash
  npx vitest run src/db/repos/placeCache.test.ts
  ```
  Expected: PASS — `Tests 3 passed`; insert, read-back, and conflict-update (single row) all green.

- [ ] **Step 5: Run the full DB suite to confirm no regressions across A1.**
  ```bash
  npx vitest run src/db scripts/migrate.test.ts
  ```
  Expected: PASS — all A1 test files green (schema, client, migrate, testDb, settings, placeCache).

- [ ] **Step 6: Commit.**
  ```bash
  git add src/db/repos/placeCache.ts src/db/repos/placeCache.test.ts
  git commit -m "feat(db): place_details_cache repo (get/upsert keyed by googlePlaceId)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task A2.1: Trips repo — `getTrips` (Active-first) & `getTrip`

**Files:**
- Create: `src/db/repos/trips.ts`
- Test: `src/db/repos/trips.test.ts`

This task creates the trips repository module and implements the two read functions. Every repo fn takes `db` as its first arg so tests inject the in-memory test db (per the DB contract). `getTrips` returns Active trips first (today ∈ `[startDate, endDate]` in the container TZ), then sorts the rest by `startDate`. `getTrip` returns one row by id or `undefined`. Both reuse `tripStatus(trip, tz)` from A0 (`src/lib/days.ts`).

- [ ] **Step 1: Write the failing test for `getTrips` Active-first ordering and `getTrip`.**

  Create `src/db/repos/trips.test.ts`:

  ```ts
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips } from '@/src/db/schema';
  import { getTrips, getTrip } from '@/src/db/repos/trips';

  // The repo reads the system clock; pin it inside the active window of the
  // "Active" fixture below.
  const TZ = 'UTC';
  const NOW = new Date('2026-06-08T12:00:00.000Z');

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    // Insert in a deliberately non-sorted order to prove the repo sorts.
    db.insert(trips).values([
      {
        id: 'past-1',
        name: 'Past Trip',
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        coverPhoto: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'upcoming-late',
        name: 'Upcoming Late',
        startDate: '2026-12-01',
        endDate: '2026-12-10',
        coverPhoto: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'active-1',
        name: 'Active Trip',
        startDate: '2026-06-05',
        endDate: '2026-06-12',
        coverPhoto: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'upcoming-early',
        name: 'Upcoming Early',
        startDate: '2026-07-01',
        endDate: '2026-07-10',
        coverPhoto: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]).run();
  }

  describe('getTrips', () => {
    let db: ReturnType<typeof makeTestDb>['db'];
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
      db = makeTestDb().db;
      seed(db);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns the active trip first, then the rest by startDate ascending', () => {
      const rows = getTrips(db, { tz: TZ });
      expect(rows.map((t) => t.id)).toEqual([
        'active-1',
        'past-1',
        'upcoming-early',
        'upcoming-late',
      ]);
    });

    it('returns an empty array when there are no trips', () => {
      const empty = makeTestDb().db;
      expect(getTrips(empty, { tz: TZ })).toEqual([]);
    });
  });

  describe('getTrip', () => {
    let db: ReturnType<typeof makeTestDb>['db'];
    beforeEach(() => {
      db = makeTestDb().db;
      seed(db);
    });

    it('returns the matching trip row', () => {
      const t = getTrip(db, 'active-1');
      expect(t?.name).toBe('Active Trip');
      expect(t?.startDate).toBe('2026-06-05');
    });

    it('returns undefined for an unknown id', () => {
      expect(getTrip(db, 'nope')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL (module not found).**

  ```
  npx vitest run src/db/repos/trips.test.ts
  ```

  Expected: FAIL — `Failed to resolve import "@/src/db/repos/trips"` (the file does not exist yet).

- [ ] **Step 3: Implement `getTrips` and `getTrip` in `src/db/repos/trips.ts`.**

  Create `src/db/repos/trips.ts`:

  ```ts
  import { eq } from 'drizzle-orm';
  import type { TestDb } from '@/src/db/testDb';
  import { trips } from '@/src/db/schema';
  import { tripStatus } from '@/src/lib/days';

  export type Trip = typeof trips.$inferSelect;

  type Db = TestDb['db'];

  export interface TimeCtx {
    tz: string;
  }

  /**
   * All trips, Active-first, then by startDate ascending (stable on id).
   * Active = today ∈ [startDate, endDate] in the given timezone.
   */
  export function getTrips(db: Db, ctx: TimeCtx): Trip[] {
    const rows = db.select().from(trips).all();
    const status = (t: Trip) =>
      tripStatus({ startDate: t.startDate, endDate: t.endDate }, ctx.tz);
    return rows.slice().sort((a, b) => {
      const aActive = status(a) === 'active' ? 0 : 1;
      const bActive = status(b) === 'active' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  /** One trip by id, or undefined. */
  export function getTrip(db: Db, id: string): Trip | undefined {
    return db.select().from(trips).where(eq(trips.id, id)).get();
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**

  ```
  npx vitest run src/db/repos/trips.test.ts
  ```

  Expected: PASS — `getTrips` (2) and `getTrip` (2), ~4 tests passed.

- [ ] **Step 5: Commit.**

  ```
  git add src/db/repos/trips.ts src/db/repos/trips.test.ts
  git commit -m "feat(trips): add getTrips (Active-first) and getTrip repo reads"
  ```

---

### Task A2.2: Trips repo — `createTrip` with `endDate >= startDate` validation

**Files:**
- Modify: `src/db/repos/trips.ts`
- Test: `src/db/repos/trips.test.ts`

`createTrip(db, {name, startDate, endDate})` validates `endDate >= startDate` (throws on violation), generates `id` via `newId()` (A0 `src/db/ids.ts`) and `createdAt`/`updatedAt` via `now()` (A0 `src/lib/clock.ts`), inserts the row, and returns it. `coverPhoto` defaults to `null`.

- [ ] **Step 1: Write the failing test.**

  Append to `src/db/repos/trips.test.ts`:

  ```ts
  import { createTrip } from '@/src/db/repos/trips';

  describe('createTrip', () => {
    let db: ReturnType<typeof makeTestDb>['db'];
    beforeEach(() => {
      db = makeTestDb().db;
    });

    it('inserts and returns a trip with generated id and timestamps', () => {
      const row = createTrip(db, {
        name: 'Kyoto',
        startDate: '2026-09-01',
        endDate: '2026-09-07',
      });
      expect(row.id).toMatch(/[0-9a-f-]{36}/);
      expect(row.name).toBe('Kyoto');
      expect(row.startDate).toBe('2026-09-01');
      expect(row.endDate).toBe('2026-09-07');
      expect(row.coverPhoto).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);

      // It is actually persisted.
      const fetched = getTrip(db, row.id);
      expect(fetched?.name).toBe('Kyoto');
    });

    it('allows a single-day trip (endDate === startDate)', () => {
      const row = createTrip(db, {
        name: 'Day Trip',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      expect(row.endDate).toBe('2026-09-01');
    });

    it('throws when endDate is before startDate', () => {
      expect(() =>
        createTrip(db, {
          name: 'Bad',
          startDate: '2026-09-07',
          endDate: '2026-09-01',
        }),
      ).toThrow(/end date/i);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**

  ```
  npx vitest run src/db/repos/trips.test.ts -t createTrip
  ```

  Expected: FAIL — `createTrip is not a function` / import resolves to `undefined`.

- [ ] **Step 3: Implement `createTrip`.**

  Add to `src/db/repos/trips.ts` (after the imports, add `newId` and `now`; append the function):

  ```ts
  import { newId } from '@/src/db/ids';
  import { now } from '@/src/lib/clock';
  ```

  ```ts
  export interface CreateTripInput {
    name: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
  }

  /**
   * Validate endDate >= startDate (string compare is safe for YYYY-MM-DD),
   * generate id + timestamps, insert, and return the created row.
   */
  export function createTrip(db: Db, input: CreateTripInput): Trip {
    if (input.endDate < input.startDate) {
      throw new Error('End date must be on or after the start date');
    }
    const ts = new Date(now());
    const row: Trip = {
      id: newId(),
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      coverPhoto: null,
      createdAt: ts,
      updatedAt: ts,
    };
    db.insert(trips).values(row).run();
    return row;
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**

  ```
  npx vitest run src/db/repos/trips.test.ts -t createTrip
  ```

  Expected: PASS — ~3 tests passed.

- [ ] **Step 5: Commit.**

  ```
  git add src/db/repos/trips.ts src/db/repos/trips.test.ts
  git commit -m "feat(trips): add createTrip with endDate>=startDate validation"
  ```

---

### Task A2.3: Trips repo — `renameTrip`, `updateTripDates`, `setCover`, `deleteTrip`

**Files:**
- Modify: `src/db/repos/trips.ts`
- Test: `src/db/repos/trips.test.ts`

The four remaining mutators. `renameTrip(db, id, name)` updates `name` + `updatedAt`. `updateTripDates(db, id, {startDate, endDate})` validates `endDate >= startDate`, updates both dates + `updatedAt`. `setCover(db, id, path|null)` updates `coverPhoto`. `deleteTrip(db, id)` deletes the row (child FKs cascade per schema). All return the updated `Trip` (or `undefined` if the id does not exist) except `deleteTrip` which returns `void`.

- [ ] **Step 1: Write the failing test.**

  Append to `src/db/repos/trips.test.ts`:

  ```ts
  import {
    renameTrip,
    updateTripDates,
    setCover,
    deleteTrip,
  } from '@/src/db/repos/trips';

  describe('trip mutators', () => {
    let db: ReturnType<typeof makeTestDb>['db'];
    let id: string;
    beforeEach(() => {
      db = makeTestDb().db;
      id = createTrip(db, {
        name: 'Original',
        startDate: '2026-09-01',
        endDate: '2026-09-07',
      }).id;
    });

    it('renameTrip updates the name and returns the row', () => {
      const row = renameTrip(db, id, 'Renamed');
      expect(row?.name).toBe('Renamed');
      expect(getTrip(db, id)?.name).toBe('Renamed');
    });

    it('renameTrip returns undefined for unknown id', () => {
      expect(renameTrip(db, 'nope', 'X')).toBeUndefined();
    });

    it('updateTripDates changes both dates', () => {
      const row = updateTripDates(db, id, {
        startDate: '2026-10-01',
        endDate: '2026-10-05',
      });
      expect(row?.startDate).toBe('2026-10-01');
      expect(row?.endDate).toBe('2026-10-05');
    });

    it('updateTripDates throws when endDate < startDate', () => {
      expect(() =>
        updateTripDates(db, id, {
          startDate: '2026-10-05',
          endDate: '2026-10-01',
        }),
      ).toThrow(/end date/i);
    });

    it('setCover sets and clears the cover path', () => {
      expect(setCover(db, id, 'covers/abc.webp')?.coverPhoto).toBe(
        'covers/abc.webp',
      );
      expect(setCover(db, id, null)?.coverPhoto).toBeNull();
    });

    it('deleteTrip removes the row', () => {
      deleteTrip(db, id);
      expect(getTrip(db, id)).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**

  ```
  npx vitest run src/db/repos/trips.test.ts -t "trip mutators"
  ```

  Expected: FAIL — `renameTrip is not a function` (functions not yet exported).

- [ ] **Step 3: Implement the four mutators.**

  Append to `src/db/repos/trips.ts`:

  ```ts
  /** Rename a trip. Returns the updated row, or undefined if not found. */
  export function renameTrip(db: Db, id: string, name: string): Trip | undefined {
    db.update(trips)
      .set({ name, updatedAt: new Date(now()) })
      .where(eq(trips.id, id))
      .run();
    return getTrip(db, id);
  }

  /** Update both trip dates (validated). Returns the updated row, or undefined. */
  export function updateTripDates(
    db: Db,
    id: string,
    dates: { startDate: string; endDate: string },
  ): Trip | undefined {
    if (dates.endDate < dates.startDate) {
      throw new Error('End date must be on or after the start date');
    }
    db.update(trips)
      .set({
        startDate: dates.startDate,
        endDate: dates.endDate,
        updatedAt: new Date(now()),
      })
      .where(eq(trips.id, id))
      .run();
    return getTrip(db, id);
  }

  /** Set or clear (null) the cover photo path. Returns the updated row. */
  export function setCover(
    db: Db,
    id: string,
    path: string | null,
  ): Trip | undefined {
    db.update(trips)
      .set({ coverPhoto: path, updatedAt: new Date(now()) })
      .where(eq(trips.id, id))
      .run();
    return getTrip(db, id);
  }

  /** Delete a trip; child rows cascade via FK onDelete. */
  export function deleteTrip(db: Db, id: string): void {
    db.delete(trips).where(eq(trips.id, id)).run();
  }
  ```

- [ ] **Step 4: Run the full repo test file — expect PASS.**

  ```
  npx vitest run src/db/repos/trips.test.ts
  ```

  Expected: PASS — all trips-repo tests green (getTrips, getTrip, createTrip, trip mutators).

- [ ] **Step 5: Commit.**

  ```
  git add src/db/repos/trips.ts src/db/repos/trips.test.ts
  git commit -m "feat(trips): add renameTrip, updateTripDates, setCover, deleteTrip"
  ```

---

### Task A2.4: Trips Server Actions — `createTripAction`, `renameTripAction`

**Files:**
- Create: `app/_actions/trips.ts`
- Test: `app/_actions/trips.test.ts`

Per the routes/DTO contract: Server Actions in `app/_actions/trips.ts`. `createTripAction` accepts either a `FormData` or a plain object `{name, startDate, endDate}`, validates with zod, calls `createTrip` against the singleton `db`, then `revalidatePath('/')` and returns the new trip. `renameTripAction(id, name)` validates, calls `renameTrip`, then `revalidatePath('/')`. The singleton `db` comes from `src/db/client.ts`; `revalidatePath` from `next/cache`. The test mocks both `next/cache` and `@/src/db/client` so it can inject the in-memory test db and assert `revalidatePath` was called.

- [ ] **Step 1: Write the failing test.**

  Create `app/_actions/trips.test.ts`:

  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';

  // The action module imports the singleton `db` from this path; we replace it
  // with a per-test in-memory db.
  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() {
      return testHandle.db;
    },
  }));

  // Spy on revalidatePath so we can assert the cache is busted.
  const revalidatePath = vi.fn();
  vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
  }));

  import { createTripAction, renameTripAction } from '@/app/_actions/trips';
  import { getTrip } from '@/src/db/repos/trips';

  describe('createTripAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      revalidatePath.mockClear();
    });

    it('creates a trip from a plain object and revalidates "/"', async () => {
      const trip = await createTripAction({
        name: 'Lisbon',
        startDate: '2026-05-01',
        endDate: '2026-05-08',
      });
      expect(trip.name).toBe('Lisbon');
      expect(getTrip(testHandle.db, trip.id)?.name).toBe('Lisbon');
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('creates a trip from FormData', async () => {
      const fd = new FormData();
      fd.set('name', 'Porto');
      fd.set('startDate', '2026-05-01');
      fd.set('endDate', '2026-05-03');
      const trip = await createTripAction(fd);
      expect(trip.name).toBe('Porto');
    });

    it('rejects an empty name', async () => {
      await expect(
        createTripAction({ name: '', startDate: '2026-05-01', endDate: '2026-05-02' }),
      ).rejects.toThrow();
    });

    it('rejects endDate before startDate', async () => {
      await expect(
        createTripAction({ name: 'X', startDate: '2026-05-08', endDate: '2026-05-01' }),
      ).rejects.toThrow();
    });
  });

  describe('renameTripAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      revalidatePath.mockClear();
    });

    it('renames an existing trip and revalidates "/"', async () => {
      const trip = await createTripAction({
        name: 'Old',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
      });
      revalidatePath.mockClear();
      await renameTripAction(trip.id, 'New');
      expect(getTrip(testHandle.db, trip.id)?.name).toBe('New');
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('rejects an empty name', async () => {
      await expect(renameTripAction('some-id', '')).rejects.toThrow();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**

  ```
  npx vitest run app/_actions/trips.test.ts
  ```

  Expected: FAIL — `Failed to resolve import "@/app/_actions/trips"`.

- [ ] **Step 3: Implement the actions.**

  Create `app/_actions/trips.ts`:

  ```ts
  'use server';

  import { z } from 'zod';
  import { revalidatePath } from 'next/cache';
  import { db } from '@/src/db/client';
  import { createTrip, renameTrip, type Trip } from '@/src/db/repos/trips';

  const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

  const createSchema = z
    .object({
      name: z.string().trim().min(1, 'Name is required'),
      startDate: dateStr,
      endDate: dateStr,
    })
    .refine((v) => v.endDate >= v.startDate, {
      message: 'End date must be on or after the start date',
      path: ['endDate'],
    });

  function asObject(input: FormData | Record<string, unknown>) {
    if (input instanceof FormData) {
      return {
        name: input.get('name'),
        startDate: input.get('startDate'),
        endDate: input.get('endDate'),
      };
    }
    return input;
  }

  export async function createTripAction(
    input: FormData | { name: string; startDate: string; endDate: string },
  ): Promise<Trip> {
    const data = createSchema.parse(asObject(input));
    const trip = createTrip(db, data);
    revalidatePath('/');
    return trip;
  }

  const renameSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1, 'Name is required'),
  });

  export async function renameTripAction(id: string, name: string): Promise<void> {
    const data = renameSchema.parse({ id, name });
    renameTrip(db, data.id, data.name);
    revalidatePath('/');
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**

  ```
  npx vitest run app/_actions/trips.test.ts
  ```

  Expected: PASS — createTripAction (4) + renameTripAction (2), ~6 tests passed.

- [ ] **Step 5: Commit.**

  ```
  git add app/_actions/trips.ts app/_actions/trips.test.ts
  git commit -m "feat(trips): add createTripAction and renameTripAction server actions"
  ```

---

### Task A2.5: Read handler — `GET /api/health`

**Files:**
- Create: `app/api/health/route.ts`
- Test: `app/api/health/route.test.ts`

Per the contract: `GET /api/health` runs a `SELECT 1` against SQLite and returns `200 {status:'ok'}`. It uses the raw sqlite handle exported from `src/db/client.ts` for the trivial probe (matching the compose healthcheck's intent). The test mocks `@/src/db/client` to provide a fake sqlite handle and asserts both the status code and body.

- [ ] **Step 1: Write the failing test.**

  Create `app/api/health/route.test.ts`:

  ```ts
  import { describe, it, expect, vi } from 'vitest';

  // Provide a fake raw sqlite handle whose prepare().get() answers SELECT 1.
  const fakeSqlite = {
    prepare: (_sql: string) => ({ get: () => ({ 1: 1 }) }),
  };
  vi.mock('@/src/db/client', () => ({
    sqlite: fakeSqlite,
    db: {},
  }));

  import { GET } from '@/app/api/health/route';

  describe('GET /api/health', () => {
    it('returns 200 with {status:"ok"} after SELECT 1', async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ status: 'ok' });
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**

  ```
  npx vitest run app/api/health/route.test.ts
  ```

  Expected: FAIL — `Failed to resolve import "@/app/api/health/route"`.

- [ ] **Step 3: Implement the handler.**

  Create `app/api/health/route.ts`:

  ```ts
  import { NextResponse } from 'next/server';
  import { sqlite } from '@/src/db/client';

  export const dynamic = 'force-dynamic';

  export function GET() {
    // Trivial liveness probe against SQLite (used by the compose healthcheck).
    sqlite.prepare('SELECT 1').get();
    return NextResponse.json({ status: 'ok' });
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**

  ```
  npx vitest run app/api/health/route.test.ts
  ```

  Expected: PASS — ~1 test passed.

- [ ] **Step 5: Commit.**

  ```
  git add app/api/health/route.ts app/api/health/route.test.ts
  git commit -m "feat(api): add GET /api/health SELECT 1 probe"
  ```

---

### Task A2.6: Read handler — `GET /api/trips` (Active-first list)

**Files:**
- Create: `app/api/trips/route.ts`
- Test: `app/api/trips/route.test.ts`

Per the routes/DTO contract: `GET /api/trips → Trip[]` (Active-first). The handler reads `env.TZ` (A0 `src/env.ts`), calls `getTrips(db, {tz})`, and returns the JSON array. This JSON GET is one of the responses the service worker caches (PWA group), so it must be plain serializable JSON. The test mocks `@/src/db/client` (in-memory db) and `@/src/env` (fixed TZ) and asserts Active-first ordering.

- [ ] **Step 1: Write the failing test.**

  Create `app/api/trips/route.test.ts`:

  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() {
      return testHandle.db;
    },
    sqlite: {},
  }));
  vi.mock('@/src/env', () => ({ env: { TZ: 'UTC' } }));

  // Pin "today" inside the active window of "active-1".
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));

  import { GET } from '@/app/api/trips/route';

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    const ts = new Date('2026-06-08T12:00:00.000Z');
    db.insert(trips).values([
      { id: 'past-1', name: 'Past', startDate: '2026-01-01', endDate: '2026-01-05', coverPhoto: null, createdAt: ts, updatedAt: ts },
      { id: 'active-1', name: 'Active', startDate: '2026-06-05', endDate: '2026-06-12', coverPhoto: null, createdAt: ts, updatedAt: ts },
      { id: 'upcoming-1', name: 'Upcoming', startDate: '2026-07-01', endDate: '2026-07-05', coverPhoto: null, createdAt: ts, updatedAt: ts },
    ]).run();
  }

  describe('GET /api/trips', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
    });

    it('returns 200 with trips Active-first', async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{ id: string }>;
      expect(body.map((t) => t.id)).toEqual(['active-1', 'past-1', 'upcoming-1']);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**

  ```
  npx vitest run app/api/trips/route.test.ts
  ```

  Expected: FAIL — `Failed to resolve import "@/app/api/trips/route"`.

- [ ] **Step 3: Implement the handler.**

  Create `app/api/trips/route.ts`:

  ```ts
  import { NextResponse } from 'next/server';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import { getTrips } from '@/src/db/repos/trips';

  export const dynamic = 'force-dynamic';

  export function GET() {
    const rows = getTrips(db, { tz: env.TZ });
    return NextResponse.json(rows);
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**

  ```
  npx vitest run app/api/trips/route.test.ts
  ```

  Expected: PASS — ~1 test passed, ordering `['active-1','past-1','upcoming-1']`.

- [ ] **Step 5: Commit.**

  ```
  git add app/api/trips/route.ts app/api/trips/route.test.ts
  git commit -m "feat(api): add GET /api/trips Active-first list handler"
  ```

---

### Task A2.7: Read handler — `GET /api/trips/[tripId]` (`{trip, days}`)

**Files:**
- Create: `app/api/trips/[tripId]/route.ts`
- Test: `app/api/trips/[tripId]/route.test.ts`

Per the routes/DTO contract: `GET /api/trips/[tripId] → { trip, days }` where `days = deriveDays(trip, TZ)` (A0 `src/lib/days.ts`). Returns `404 {error:'not_found'}` when the id is unknown. In Next 15 the dynamic-segment `params` arrive as a `Promise`, so the handler awaits `ctx.params`. The test mocks the db (in-memory) and env (TZ) and asserts the DTO shape for a known trip plus the 404 path.

- [ ] **Step 1: Write the failing test.**

  Create `app/api/trips/[tripId]/route.test.ts`:

  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() {
      return testHandle.db;
    },
    sqlite: {},
  }));
  vi.mock('@/src/env', () => ({ env: { TZ: 'UTC' } }));

  import { GET } from '@/app/api/trips/[tripId]/route';

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    const ts = new Date('2026-06-08T12:00:00.000Z');
    db.insert(trips).values({
      id: 'trip-1',
      name: 'Osaka',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: ts,
      updatedAt: ts,
    }).run();
  }

  function ctx(tripId: string) {
    return { params: Promise.resolve({ tripId }) };
  }

  describe('GET /api/trips/[tripId]', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
    });

    it('returns 200 with {trip, days} for a known trip', async () => {
      const res = await GET(new Request('http://x/api/trips/trip-1'), ctx('trip-1'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        trip: { id: string; name: string };
        days: Array<{ date: string; dayNumber: number }>;
      };
      expect(body.trip.id).toBe('trip-1');
      expect(body.trip.name).toBe('Osaka');
      // 2026-06-05..2026-06-07 inclusive → 3 days
      expect(body.days.map((d) => d.date)).toEqual([
        '2026-06-05',
        '2026-06-06',
        '2026-06-07',
      ]);
      expect(body.days[0].dayNumber).toBe(1);
    });

    it('returns 404 for an unknown trip', async () => {
      const res = await GET(new Request('http://x/api/trips/nope'), ctx('nope'));
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: 'not_found' });
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**

  ```
  npx vitest run app/api/trips/[tripId]/route.test.ts
  ```

  Expected: FAIL — `Failed to resolve import "@/app/api/trips/[tripId]/route"`.

- [ ] **Step 3: Implement the handler.**

  Create `app/api/trips/[tripId]/route.ts`:

  ```ts
  import { NextResponse } from 'next/server';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import { getTrip } from '@/src/db/repos/trips';
  import { deriveDays } from '@/src/lib/days';

  export const dynamic = 'force-dynamic';

  export async function GET(
    _req: Request,
    ctx: { params: Promise<{ tripId: string }> },
  ) {
    const { tripId } = await ctx.params;
    const trip = getTrip(db, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const days = deriveDays(trip, env.TZ);
    return NextResponse.json({ trip, days });
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**

  ```
  npx vitest run app/api/trips/[tripId]/route.test.ts
  ```

  Expected: PASS — ~2 tests passed (the `{trip, days}` DTO and the 404 path).

- [ ] **Step 5: Commit.**

  ```
  git add "app/api/trips/[tripId]/route.ts" "app/api/trips/[tripId]/route.test.ts"
  git commit -m "feat(api): add GET /api/trips/[tripId] returning {trip, days}"
  ```

---

### Task A2.8: Group verification — full A2 suite green

**Files:**
- Modify: none (verification only)

A final gate that runs every A2 test together to confirm the repo, actions, and three handlers all pass as a unit and nothing in this group regressed.

- [ ] **Step 1: Run the entire A2 test set.**

  ```
  npx vitest run src/db/repos/trips.test.ts app/_actions/trips.test.ts app/api/health/route.test.ts app/api/trips/route.test.ts "app/api/trips/[tripId]/route.test.ts"
  ```

  Expected: PASS — all five files green (trips repo: getTrips/getTrip/createTrip/mutators; createTripAction + renameTripAction; health; trips list; trip detail).

- [ ] **Step 2: Run the full project test suite to confirm no cross-group regression.**

  ```
  npm test
  ```

  Expected: PASS — the complete Vitest run (A0/A1 + A2) is green with no failures.

- [ ] **Step 3: Commit the verification checkpoint (empty commit marker).**

  ```
  git commit --allow-empty -m "test(trips): A2 trips repo, actions, and read handlers all green"
  ```

---

### Task A3.1: i18n request config + English messages catalog

**Files:**
- Create: `i18n/request.ts`
- Create: `messages/en.json`
- Test: `i18n/request.test.ts`

This group depends on every visible string resolving through `messages/en.json`. We build the next-intl request config (cookie-ready, falls back to `en`) and the full English catalog first, since every later component reads keys from it.

- [ ] **Step 1: Write the failing test for the request config.**
  Create `i18n/request.test.ts`:
  ```ts
  import { describe, it, expect, vi } from 'vitest';

  vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
      get: (name: string) =>
        name === 'BURGERGO_LOCALE' ? { value: 'en' } : undefined,
    })),
  }));

  import getRequestConfig from './request';

  describe('i18n/request', () => {
    it('returns the en locale and loads en messages', async () => {
      // next-intl calls the default export with an internal arg object.
      const config = await (getRequestConfig as unknown as (a: unknown) => Promise<{
        locale: string;
        messages: Record<string, unknown>;
      }>)({});
      expect(config.locale).toBe('en');
      expect(config.messages).toBeTypeOf('object');
      expect((config.messages as Record<string, Record<string, string>>).home.title).toBe(
        'BurgerGo',
      );
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL (module not found).**
  ```bash
  npx vitest run i18n/request.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "./request"` (and `messages/en.json` missing).

- [ ] **Step 3: Create the English messages catalog.**
  Create `messages/en.json` with every UI string this group renders:
  ```json
  {
    "app": {
      "name": "BurgerGo",
      "tagline": "Your personal travel companion"
    },
    "home": {
      "title": "BurgerGo",
      "settings": "Settings",
      "newTrip": "New trip",
      "emptyHeadline": "Where to first?",
      "emptySubtext": "Plan your first trip and BurgerGo will tag along.",
      "emptyCta": "New trip"
    },
    "status": {
      "upcoming": "Upcoming",
      "active": "Active",
      "past": "Past"
    },
    "tripCard": {
      "dateRange": "{start} – {end} · {days, plural, one {# day} other {# days}}"
    },
    "newTripSheet": {
      "title": "New trip",
      "nameLabel": "Trip name",
      "namePlaceholder": "Tokyo adventure",
      "startLabel": "Start date",
      "endLabel": "End date",
      "endBeforeStart": "End date must be on or after the start date.",
      "nameRequired": "Please enter a trip name.",
      "cancel": "Cancel",
      "create": "Create trip"
    },
    "renameSheet": {
      "title": "Rename trip",
      "nameLabel": "Trip name",
      "nameRequired": "Please enter a trip name.",
      "cancel": "Cancel",
      "save": "Save"
    },
    "tabs": {
      "plan": "Plan",
      "eats": "Eats",
      "budget": "Budget",
      "journal": "Journal"
    },
    "trip": {
      "back": "Back",
      "rename": "Rename"
    },
    "comingSoon": {
      "plan": "Plan is on its way",
      "eats": "Eats is on its way",
      "budget": "Budget is on its way",
      "journal": "Journal is on its way",
      "subtext": "BurgerGo is still unpacking this one. Check back soon."
    },
    "settings": {
      "title": "Settings",
      "language": "Language",
      "currency": "Currency",
      "comingSoon": "Settings controls are on their way.",
      "about": "About",
      "aboutTagline": "Your personal travel companion"
    },
    "offline": {
      "banner": "Offline — viewing saved data. Editing needs a connection.",
      "disabledTooltip": "Connect to the internet to make changes."
    },
    "mascot": {
      "alt": "BurgerGo the Siamese cat"
    }
  }
  ```

  > Note: `offline.banner` is defined here in this group's `messages/en.json` (this group is its sole definer); group A4's `OfflineBanner` component reads this key.

- [ ] **Step 4: Create the request config.**
  Create `i18n/request.ts`:
  ```ts
  import { getRequestConfig } from 'next-intl/server';
  import { cookies } from 'next/headers';
  import en from '@/messages/en.json';

  // Only English ships in Plan 1A; zh.json + the toggle arrive in a later plan.
  const SUPPORTED = ['en'] as const;
  type Locale = (typeof SUPPORTED)[number];

  function resolveLocale(cookieValue: string | undefined): Locale {
    if (cookieValue && (SUPPORTED as readonly string[]).includes(cookieValue)) {
      return cookieValue as Locale;
    }
    return 'en';
  }

  export default getRequestConfig(async () => {
    const store = await cookies();
    const locale = resolveLocale(store.get('BURGERGO_LOCALE')?.value);
    return {
      locale,
      messages: en,
    };
  });
  ```

- [ ] **Step 5: Run the test — expect PASS.**
  ```bash
  npx vitest run i18n/request.test.ts
  ```
  Expected: PASS — ~1 test (`returns the en locale and loads en messages`).

- [ ] **Step 6: Commit.**
  ```bash
  git add i18n/request.ts i18n/request.test.ts messages/en.json
  git commit -m "feat(i18n): next-intl request config + English messages catalog"
  ```

---

### Task A3.2: EmptyState component (mascot)

**Files:**
- Create: `components/EmptyState.tsx`
- Test: `components/EmptyState.test.tsx`

Reusable empty/coming-soon block: mascot image (`/burgergo-logo.png`), headline, subtext, optional Coral CTA.

- [ ] **Step 1: Write the failing test.**
  Create `components/EmptyState.test.tsx`:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { EmptyState } from './EmptyState';

  describe('EmptyState', () => {
    it('renders headline, subtext, and mascot', () => {
      render(
        <EmptyState
          mascotAlt="BurgerGo the Siamese cat"
          headline="Where to first?"
          subtext="Plan your first trip and BurgerGo will tag along."
        />,
      );
      expect(screen.getByText('Where to first?')).toBeInTheDocument();
      expect(
        screen.getByText('Plan your first trip and BurgerGo will tag along.'),
      ).toBeInTheDocument();
      const img = screen.getByAltText('BurgerGo the Siamese cat') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('/burgergo-logo.png');
    });

    it('renders no button when no action is given', () => {
      render(<EmptyState mascotAlt="cat" headline="Empty" subtext="Nothing here" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('fires the action handler when the CTA is clicked', async () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          mascotAlt="cat"
          headline="Empty"
          subtext="Nothing here"
          actionLabel="New trip"
          onAction={onAction}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'New trip' }));
      expect(onAction).toHaveBeenCalledOnce();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/EmptyState.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./EmptyState"`.

- [ ] **Step 3: Implement the component.**
  Create `components/EmptyState.tsx`:
  ```tsx
  'use client';

  type EmptyStateProps = {
    mascotAlt: string;
    headline: string;
    subtext: string;
    actionLabel?: string;
    onAction?: () => void;
  };

  export function EmptyState({
    mascotAlt,
    headline,
    subtext,
    actionLabel,
    onAction,
  }: EmptyStateProps) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Bundled mascot asset → always renders offline (§9.6). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/burgergo-logo.png"
          alt={mascotAlt}
          width={112}
          height={112}
          className="mb-6 h-28 w-28 opacity-90"
        />
        <h2 className="text-heading font-semibold text-ink">{headline}</h2>
        <p className="mt-2 max-w-xs text-body text-ink-muted">{subtext}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 rounded-control bg-coral px-5 py-3 text-label font-medium text-white shadow-card active:bg-coral-press"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/EmptyState.test.tsx
  ```
  Expected: PASS — ~3 tests.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/EmptyState.tsx components/EmptyState.test.tsx
  git commit -m "feat(ui): EmptyState mascot block with optional coral CTA"
  ```

---

### Task A3.3: TripCard component (cover, date range, status pill)

**Files:**
- Create: `components/TripCard.tsx`
- Test: `components/TripCard.test.tsx`

Full-width card linking to `/trip/[id]`. Sun→Coral gradient cover, name, "Mon DD – Mon DD · N days", status pill colored by `tripStatus()` from `@/src/lib/days`. In Plan 1A `coverPhoto` is always null, so the card always renders the gradient cover.

- [ ] **Step 1: Write the failing test.**
  Create `components/TripCard.test.tsx`:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';
  import { TripCard } from './TripCard';
  import type { Trip } from '@/src/db/schema';

  vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }));

  function makeTrip(over: Partial<Trip> = {}): Trip {
    return {
      id: 't1',
      name: 'Tokyo adventure',
      startDate: '2026-05-03',
      endDate: '2026-05-09',
      coverPhoto: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      ...over,
    } as Trip;
  }

  function renderCard(trip: Trip) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TripCard trip={trip} tz="UTC" />
      </NextIntlClientProvider>,
    );
  }

  describe('TripCard', () => {
    it('links to the trip and shows its name + day count', () => {
      // Future trip relative to a fixed today; status pill = Upcoming.
      vi.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00Z'));
      renderCard(makeTrip());
      expect(screen.getByText('Tokyo adventure')).toBeInTheDocument();
      expect(screen.getByText(/· 7 days/)).toBeInTheDocument();
      expect(screen.getByRole('link').getAttribute('href')).toBe('/trip/t1');
      vi.useRealTimers();
    });

    it('shows the Upcoming pill for a future trip', () => {
      vi.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00Z'));
      renderCard(makeTrip());
      expect(screen.getByText(en.status.upcoming)).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('shows the Active pill when today is within the date range', () => {
      vi.useFakeTimers().setSystemTime(new Date('2026-05-05T12:00:00Z'));
      renderCard(makeTrip());
      expect(screen.getByText(en.status.active)).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('shows the Past pill for a finished trip', () => {
      vi.useFakeTimers().setSystemTime(new Date('2026-06-01T12:00:00Z'));
      renderCard(makeTrip());
      expect(screen.getByText(en.status.past)).toBeInTheDocument();
      vi.useRealTimers();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/TripCard.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./TripCard"`.

- [ ] **Step 3: Implement the component.**
  Create `components/TripCard.tsx`:
  ```tsx
  import Link from 'next/link';
  import { useTranslations } from 'next-intl';
  import type { Trip } from '@/src/db/schema';
  import { tripStatus } from '@/src/lib/days';

  const COVER_GRADIENT =
    'linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)';

  // Pill background/text per spec §3.1: Upcoming=Sun, Active=Coral, Past=Teal-muted.
  const PILL_CLASS: Record<'upcoming' | 'active' | 'past', string> = {
    upcoming: 'bg-sun-tint text-ink',
    active: 'bg-coral text-white',
    past: 'bg-teal-tint text-teal',
  };

  function formatRange(startDate: string, endDate: string): {
    start: string;
    end: string;
    days: number;
  } {
    const fmt = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
    const end = fmt.format(new Date(`${endDate}T00:00:00Z`));
    const ms =
      new Date(`${endDate}T00:00:00Z`).getTime() -
      new Date(`${startDate}T00:00:00Z`).getTime();
    const days = Math.round(ms / 86_400_000) + 1;
    return { start, end, days };
  }

  export function TripCard({ trip, tz }: { trip: Trip; tz: string }) {
    const t = useTranslations();
    const status = tripStatus(trip, tz);
    const { start, end, days } = formatRange(trip.startDate, trip.endDate);

    return (
      <Link
        href={`/trip/${trip.id}`}
        className="block overflow-hidden rounded-card shadow-card"
      >
        <div
          className="relative flex h-40 flex-col justify-end p-4"
          // future: a later plan serves cover photos via /api/photos
          style={{ backgroundImage: COVER_GRADIENT }}
        >
          <span
            className={`absolute right-3 top-3 rounded-chip px-3 py-1 text-caption font-medium ${PILL_CLASS[status]}`}
          >
            {t(`status.${status}`)}
          </span>
          <span className="text-display font-bold text-white drop-shadow">
            {trip.name}
          </span>
          <span className="mt-1 text-caption font-medium text-white/90 [font-variant-numeric:tabular-nums]">
            {t('tripCard.dateRange', { start, end, days })}
          </span>
        </div>
      </Link>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/TripCard.test.tsx
  ```
  Expected: PASS — ~4 tests.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/TripCard.tsx components/TripCard.test.tsx
  git commit -m "feat(ui): TripCard with Sun→Coral cover, date range, status pill"
  ```

---

### Task A3.4: NewTripSheet component (date validation)

**Files:**
- Create: `components/NewTripSheet.tsx`
- Test: `components/NewTripSheet.test.tsx`

Client bottom sheet with native date inputs. Inline error when `endDate < startDate` or name is blank; otherwise calls `createTripAction` from `@/app/_actions/trips`.

- [ ] **Step 1: Write the failing test.**
  Create `components/NewTripSheet.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  const createTripAction = vi.fn(async () => ({ id: 't-new' }));
  vi.mock('@/app/_actions/trips', () => ({
    createTripAction: (...args: unknown[]) => createTripAction(...args),
    renameTripAction: vi.fn(),
  }));

  import { NewTripSheet } from './NewTripSheet';

  function renderSheet(onClose = vi.fn()) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <NewTripSheet open onClose={onClose} />
      </NextIntlClientProvider>,
    );
  }

  beforeEach(() => {
    createTripAction.mockClear();
  });

  describe('NewTripSheet', () => {
    it('shows an inline error and does not submit when end < start', async () => {
      renderSheet();
      await userEvent.type(screen.getByLabelText(en.newTripSheet.nameLabel), 'Tokyo');
      const start = screen.getByLabelText(en.newTripSheet.startLabel);
      const end = screen.getByLabelText(en.newTripSheet.endLabel);
      await userEvent.type(start, '2026-05-09');
      await userEvent.type(end, '2026-05-03');
      await userEvent.click(screen.getByRole('button', { name: en.newTripSheet.create }));
      expect(screen.getByText(en.newTripSheet.endBeforeStart)).toBeInTheDocument();
      expect(createTripAction).not.toHaveBeenCalled();
    });

    it('shows an inline error when the name is blank', async () => {
      renderSheet();
      const start = screen.getByLabelText(en.newTripSheet.startLabel);
      const end = screen.getByLabelText(en.newTripSheet.endLabel);
      await userEvent.type(start, '2026-05-03');
      await userEvent.type(end, '2026-05-09');
      await userEvent.click(screen.getByRole('button', { name: en.newTripSheet.create }));
      expect(screen.getByText(en.newTripSheet.nameRequired)).toBeInTheDocument();
      expect(createTripAction).not.toHaveBeenCalled();
    });

    it('calls createTripAction with valid input', async () => {
      const onClose = vi.fn();
      renderSheet(onClose);
      await userEvent.type(screen.getByLabelText(en.newTripSheet.nameLabel), 'Tokyo');
      await userEvent.type(screen.getByLabelText(en.newTripSheet.startLabel), '2026-05-03');
      await userEvent.type(screen.getByLabelText(en.newTripSheet.endLabel), '2026-05-09');
      await userEvent.click(screen.getByRole('button', { name: en.newTripSheet.create }));
      expect(createTripAction).toHaveBeenCalledWith({
        name: 'Tokyo',
        startDate: '2026-05-03',
        endDate: '2026-05-09',
      });
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/NewTripSheet.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./NewTripSheet"`.

- [ ] **Step 3: Implement the component.**
  Create `components/NewTripSheet.tsx`:
  ```tsx
  'use client';

  import { useState, useTransition } from 'react';
  import { useTranslations } from 'next-intl';
  import { createTripAction } from '@/app/_actions/trips';

  type NewTripSheetProps = {
    open: boolean;
    onClose: () => void;
  };

  export function NewTripSheet({ open, onClose }: NewTripSheetProps) {
    const t = useTranslations('newTripSheet');
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!open) return null;

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setError(null);
      if (name.trim().length === 0) {
        setError(t('nameRequired'));
        return;
      }
      if (startDate && endDate && endDate < startDate) {
        setError(t('endBeforeStart'));
        return;
      }
      startTransition(async () => {
        await createTripAction({ name: name.trim(), startDate, endDate });
        onClose();
      });
    }

    return (
      <div
        role="dialog"
        aria-label={t('title')}
        className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
        onClick={onClose}
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-full rounded-t-sheet bg-card p-6 shadow-lift"
        >
          <h2 className="text-title font-bold text-ink">{t('title')}</h2>

          <label className="mt-4 block text-label font-medium text-ink" htmlFor="trip-name">
            {t('nameLabel')}
          </label>
          <input
            id="trip-name"
            type="text"
            value={name}
            placeholder={t('namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
          />

          <label className="mt-4 block text-label font-medium text-ink" htmlFor="trip-start">
            {t('startLabel')}
          </label>
          <input
            id="trip-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
          />

          <label className="mt-4 block text-label font-medium text-ink" htmlFor="trip-end">
            {t('endLabel')}
          </label>
          <input
            id="trip-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
          />

          {error ? (
            <p role="alert" className="mt-3 text-caption font-medium text-[#C2452E]">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-50"
            >
              {t('create')}
            </button>
          </div>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/NewTripSheet.test.tsx
  ```
  Expected: PASS — ~3 tests.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/NewTripSheet.tsx components/NewTripSheet.test.tsx
  git commit -m "feat(ui): NewTripSheet with inline end≥start + name validation"
  ```

---

### Task A3.5: RenameSheet component

**Files:**
- Create: `components/RenameSheet.tsx`
- Test: `components/RenameSheet.test.tsx`

Client sheet pre-filled with the current name; calls `renameTripAction(id, name)` from `@/app/_actions/trips`.

- [ ] **Step 1: Write the failing test.**
  Create `components/RenameSheet.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  const renameTripAction = vi.fn(async () => undefined);
  vi.mock('@/app/_actions/trips', () => ({
    createTripAction: vi.fn(),
    renameTripAction: (...args: unknown[]) => renameTripAction(...args),
  }));

  import { RenameSheet } from './RenameSheet';

  function renderSheet(onClose = vi.fn()) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <RenameSheet open tripId="t1" currentName="Tokyo" onClose={onClose} />
      </NextIntlClientProvider>,
    );
  }

  beforeEach(() => {
    renameTripAction.mockClear();
  });

  describe('RenameSheet', () => {
    it('pre-fills the current name', () => {
      renderSheet();
      expect(
        (screen.getByLabelText(en.renameSheet.nameLabel) as HTMLInputElement).value,
      ).toBe('Tokyo');
    });

    it('blocks save and shows an error when the name is cleared', async () => {
      renderSheet();
      await userEvent.clear(screen.getByLabelText(en.renameSheet.nameLabel));
      await userEvent.click(screen.getByRole('button', { name: en.renameSheet.save }));
      expect(screen.getByText(en.renameSheet.nameRequired)).toBeInTheDocument();
      expect(renameTripAction).not.toHaveBeenCalled();
    });

    it('calls renameTripAction with the trimmed new name', async () => {
      const onClose = vi.fn();
      renderSheet(onClose);
      const input = screen.getByLabelText(en.renameSheet.nameLabel);
      await userEvent.clear(input);
      await userEvent.type(input, '  Kyoto  ');
      await userEvent.click(screen.getByRole('button', { name: en.renameSheet.save }));
      expect(renameTripAction).toHaveBeenCalledWith('t1', 'Kyoto');
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/RenameSheet.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./RenameSheet"`.

- [ ] **Step 3: Implement the component.**
  Create `components/RenameSheet.tsx`:
  ```tsx
  'use client';

  import { useState, useTransition } from 'react';
  import { useTranslations } from 'next-intl';
  import { renameTripAction } from '@/app/_actions/trips';

  type RenameSheetProps = {
    open: boolean;
    tripId: string;
    currentName: string;
    onClose: () => void;
  };

  export function RenameSheet({ open, tripId, currentName, onClose }: RenameSheetProps) {
    const t = useTranslations('renameSheet');
    const [name, setName] = useState(currentName);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!open) return null;

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setError(null);
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        setError(t('nameRequired'));
        return;
      }
      startTransition(async () => {
        await renameTripAction(tripId, trimmed);
        onClose();
      });
    }

    return (
      <div
        role="dialog"
        aria-label={t('title')}
        className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
        onClick={onClose}
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-full rounded-t-sheet bg-card p-6 shadow-lift"
        >
          <h2 className="text-title font-bold text-ink">{t('title')}</h2>

          <label className="mt-4 block text-label font-medium text-ink" htmlFor="rename-name">
            {t('nameLabel')}
          </label>
          <input
            id="rename-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
          />

          {error ? (
            <p role="alert" className="mt-3 text-caption font-medium text-[#C2452E]">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-50"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/RenameSheet.test.tsx
  ```
  Expected: PASS — ~3 tests.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/RenameSheet.tsx components/RenameSheet.test.tsx
  git commit -m "feat(ui): RenameSheet pre-filled name + renameTripAction wiring"
  ```

---

### Task A3.6: BottomTabBar component (active-tab state)

**Files:**
- Create: `components/BottomTabBar.tsx`
- Test: `components/BottomTabBar.test.tsx`

Fixed 4-tab bar (Plan · Eats · Budget · Journal). Active tab via `usePathname()`: Coral active, Ink-muted inactive. Labels from `messages/en.json`.

- [ ] **Step 1: Write the failing test.**
  Create `components/BottomTabBar.test.tsx`:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  const usePathname = vi.fn(() => '/trip/t1/plan');
  vi.mock('next/navigation', () => ({
    usePathname: () => usePathname(),
  }));
  vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  }));

  import { BottomTabBar } from './BottomTabBar';

  function renderBar() {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BottomTabBar tripId="t1" />
      </NextIntlClientProvider>,
    );
  }

  describe('BottomTabBar', () => {
    it('renders all four tabs with correct hrefs', () => {
      renderBar();
      expect(screen.getByRole('link', { name: en.tabs.plan }).getAttribute('href')).toBe(
        '/trip/t1/plan',
      );
      expect(screen.getByRole('link', { name: en.tabs.eats }).getAttribute('href')).toBe(
        '/trip/t1/eats',
      );
      expect(screen.getByRole('link', { name: en.tabs.budget }).getAttribute('href')).toBe(
        '/trip/t1/budget',
      );
      expect(screen.getByRole('link', { name: en.tabs.journal }).getAttribute('href')).toBe(
        '/trip/t1/journal',
      );
    });

    it('marks the active tab with aria-current based on the pathname', () => {
      usePathname.mockReturnValue('/trip/t1/eats');
      renderBar();
      expect(screen.getByRole('link', { name: en.tabs.eats })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: en.tabs.plan })).not.toHaveAttribute(
        'aria-current',
      );
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/BottomTabBar.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./BottomTabBar"`.

- [ ] **Step 3: Implement the component.**
  Create `components/BottomTabBar.tsx`:
  ```tsx
  'use client';

  import Link from 'next/link';
  import { usePathname } from 'next/navigation';
  import { useTranslations } from 'next-intl';

  const TABS = ['plan', 'eats', 'budget', 'journal'] as const;
  type Tab = (typeof TABS)[number];

  export function BottomTabBar({ tripId }: { tripId: string }) {
    const t = useTranslations('tabs');
    const pathname = usePathname();

    function isActive(tab: Tab): boolean {
      return pathname === `/trip/${tripId}/${tab}` || pathname.startsWith(`/trip/${tripId}/${tab}/`);
    }

    return (
      <nav
        aria-label="Trip sections"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card shadow-lift [padding-bottom:env(safe-area-inset-bottom)]"
      >
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab}
              href={`/trip/${tripId}/${tab}`}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 text-label font-medium ${
                active ? 'text-coral' : 'text-ink-muted'
              }`}
            >
              {active ? (
                <span className="absolute inset-x-0 top-0 mx-auto h-[3px] w-8 rounded-chip bg-coral" />
              ) : null}
              {t(tab)}
            </Link>
          );
        })}
      </nav>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/BottomTabBar.test.tsx
  ```
  Expected: PASS — ~2 tests.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/BottomTabBar.tsx components/BottomTabBar.test.tsx
  git commit -m "feat(ui): BottomTabBar with usePathname-driven active state"
  ```

---

### Task A3.7: Root layout (fonts, Paper bg, provider, SWRegister, OfflineBanner)

**Files:**
- Create: `app/layout.tsx`
- Verify: build/typecheck (no unit test — server layout composition)

The root layout wires `next/font` (Inter + Noto Sans SC font variables), the Paper background, `NextIntlClientProvider` (en messages), `<SWRegister/>` (from group A4's PWA work, named import from `@/components/SWRegister`), and `<OfflineBanner/>` (from group A4, named import from `@/components/OfflineBanner`). It also declares the manifest + theme metadata.

- [ ] **Step 1: Create the root layout.**
  Create `app/layout.tsx`:
  ```tsx
  import type { Metadata, Viewport } from 'next';
  import { Inter, Noto_Sans_SC } from 'next/font/google';
  import { NextIntlClientProvider } from 'next-intl';
  import { getMessages } from 'next-intl/server';
  import { SWRegister } from '@/components/SWRegister';
  import { OfflineBanner } from '@/components/OfflineBanner';
  import './globals.css';

  const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
  });

  const notoSansSC = Noto_Sans_SC({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-noto-sc',
    display: 'swap',
  });

  export const metadata: Metadata = {
    title: 'BurgerGo',
    description: 'Your personal travel-planning assistant.',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: 'BurgerGo',
      statusBarStyle: 'default',
    },
    icons: {
      apple: '/icons/apple-touch-icon.png',
    },
  };

  export const viewport: Viewport = {
    themeColor: '#EE5B3C',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };

  export default async function RootLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const messages = await getMessages();
    return (
      <html lang="en" className={`${inter.variable} ${notoSansSC.variable}`}>
        <body className="min-h-screen bg-paper font-sans text-ink antialiased">
          <NextIntlClientProvider messages={messages}>
            <OfflineBanner />
            {children}
            <SWRegister />
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }
  ```

  > Note: `--font-sans` (used by Tailwind's `font-sans`) resolves to these two font variables. It is defined in `app/globals.css` (group A0) as `--font-sans: var(--font-inter), var(--font-noto-sc), system-ui, sans-serif;`. This layout only exposes `--font-inter` + `--font-noto-sc` on `<html>` and consumes `font-sans`; it does not define `--font-sans` itself.

- [ ] **Step 2: Verify it typechecks.**
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors referencing `app/layout.tsx` (imports `@/components/SWRegister`, `@/components/OfflineBanner` resolve; `next/font/google` types resolve).

- [ ] **Step 3: Commit.**
  ```bash
  git add app/layout.tsx
  git commit -m "feat(app): root layout with fonts, Paper bg, intl provider, SW + offline banner"
  ```

---

### Task A3.8: Home page + home layout (trips list, FAB, empty state)

**Files:**
- Create: `app/(home)/layout.tsx`
- Create: `app/(home)/page.tsx`
- Create: `components/HomeClient.tsx`
- Test: `components/HomeClient.test.tsx`

The server `page.tsx` loads trips via the repo (Active-first sort is the repo's contract) and the `TZ` env; it renders the client `HomeClient`, which owns the New Trip FAB, the sheet open/close state, the empty state, and the trip card list. The home `layout.tsx` provides the top chrome (wordmark + Settings gear).

- [ ] **Step 1: Write the failing test for HomeClient.**
  Create `components/HomeClient.test.tsx`:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';
  import type { Trip } from '@/src/db/schema';

  vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }));
  vi.mock('@/app/_actions/trips', () => ({
    createTripAction: vi.fn(),
    renameTripAction: vi.fn(),
  }));

  import { HomeClient } from './HomeClient';

  function makeTrip(over: Partial<Trip> = {}): Trip {
    return {
      id: 't1',
      name: 'Tokyo adventure',
      startDate: '2026-05-03',
      endDate: '2026-05-09',
      coverPhoto: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      ...over,
    } as Trip;
  }

  function renderHome(trips: Trip[]) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HomeClient trips={trips} tz="UTC" />
      </NextIntlClientProvider>,
    );
  }

  describe('HomeClient', () => {
    it('shows the empty state when there are no trips', () => {
      renderHome([]);
      expect(screen.getByText(en.home.emptyHeadline)).toBeInTheDocument();
      expect(screen.getByText(en.home.emptySubtext)).toBeInTheDocument();
    });

    it('lists trip cards when trips exist', () => {
      vi.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00Z'));
      renderHome([makeTrip()]);
      expect(screen.getByText('Tokyo adventure')).toBeInTheDocument();
      expect(screen.queryByText(en.home.emptyHeadline)).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('opens the New Trip sheet from the FAB', async () => {
      renderHome([makeTrip()]);
      await userEvent.click(screen.getByRole('button', { name: en.home.newTrip }));
      expect(screen.getByRole('dialog', { name: en.newTripSheet.title })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/HomeClient.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./HomeClient"`.

- [ ] **Step 3: Implement HomeClient.**
  Create `components/HomeClient.tsx`:
  ```tsx
  'use client';

  import { useState } from 'react';
  import { useTranslations } from 'next-intl';
  import type { Trip } from '@/src/db/schema';
  import { TripCard } from '@/components/TripCard';
  import { NewTripSheet } from '@/components/NewTripSheet';
  import { EmptyState } from '@/components/EmptyState';

  export function HomeClient({ trips, tz }: { trips: Trip[]; tz: string }) {
    const t = useTranslations();
    const [sheetOpen, setSheetOpen] = useState(false);

    return (
      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
        {trips.length === 0 ? (
          <EmptyState
            mascotAlt={t('mascot.alt')}
            headline={t('home.emptyHeadline')}
            subtext={t('home.emptySubtext')}
            actionLabel={t('home.emptyCta')}
            onAction={() => setSheetOpen(true)}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {trips.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} tz={tz} />
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          aria-label={t('home.newTrip')}
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-chip bg-coral text-2xl font-bold text-white shadow-lift active:bg-coral-press"
        >
          +
        </button>

        <NewTripSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </main>
    );
  }
  ```

  > The FAB uses `aria-label={t('home.newTrip')}` so the test's `getByRole('button', { name: 'New trip' })` resolves the glyph-only FAB.

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/HomeClient.test.tsx
  ```
  Expected: PASS — ~3 tests.

- [ ] **Step 5: Create the home layout.**
  Create `app/(home)/layout.tsx`:
  ```tsx
  import Link from 'next/link';
  import { getTranslations } from 'next-intl/server';

  export default async function HomeLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const t = await getTranslations();
    return (
      <div className="min-h-screen">
        <header className="flex items-center justify-between px-4 py-3">
          <span className="text-title font-bold text-coral">{t('home.title')}</span>
          <Link
            href="/settings"
            aria-label={t('home.settings')}
            className="flex h-11 w-11 items-center justify-center rounded-chip text-ink"
          >
            {/* Settings gear (inline SVG, inherits currentColor, offline-safe) */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </header>
        {children}
      </div>
    );
  }
  ```

- [ ] **Step 6: Create the home page (server).**
  Create `app/(home)/page.tsx`:
  ```tsx
  import { db } from '@/src/db/client';
  import { getTrips } from '@/src/db/repos/trips';
  import { env } from '@/src/env';
  import { HomeClient } from '@/components/HomeClient';

  // Home reads live DB state; never statically cached.
  export const dynamic = 'force-dynamic';

  export default async function HomePage() {
    // getTrips is synchronous; pass the { tz } ctx for Active-first sort.
    const trips = getTrips(db, { tz: env.TZ }); // repo returns Active-first then date order
    return <HomeClient trips={trips} tz={env.TZ} />;
  }
  ```

- [ ] **Step 7: Verify the new server files typecheck.**
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors for `app/(home)/layout.tsx` or `app/(home)/page.tsx` (`@/src/db/client`, `@/src/db/repos/trips`, `@/src/env` resolve from earlier groups).

- [ ] **Step 8: Commit.**
  ```bash
  git add app/\(home\)/layout.tsx app/\(home\)/page.tsx components/HomeClient.tsx components/HomeClient.test.tsx
  git commit -m "feat(home): trips list (Active-first), New Trip FAB, empty state, home chrome"
  ```

---

### Task A3.9: Settings placeholder page

**Files:**
- Create: `app/(home)/settings/page.tsx`
- Verify: typecheck (server page; controls deferred to a later plan)

A minimal, viewable Settings page on Paper. Language/Currency are shown as disabled placeholders (real toggle is a later plan); About block uses the mascot. All strings from `messages/en.json`.

- [ ] **Step 1: Create the settings page.**
  Create `app/(home)/settings/page.tsx`:
  ```tsx
  import Link from 'next/link';
  import { getTranslations } from 'next-intl/server';
  import { db } from '@/src/db/client';
  import { getSettings } from '@/src/db/repos/settings';

  export const dynamic = 'force-dynamic';

  export default async function SettingsPage() {
    const t = await getTranslations();
    const settings = getSettings(db); // getSettings is synchronous

    return (
      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
        <header className="flex items-center gap-2 py-2">
          <Link
            href="/"
            aria-label={t('trip.back')}
            className="flex h-11 w-11 items-center justify-center rounded-chip text-ink"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-title font-bold text-ink">{t('settings.title')}</h1>
        </header>

        <section className="mt-2 rounded-card bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-body text-ink">{t('settings.language')}</span>
            <span className="text-label font-medium text-ink-muted">
              {settings?.language ?? 'en'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-body text-ink">{t('settings.currency')}</span>
            <span className="text-label font-medium text-ink-muted [font-variant-numeric:tabular-nums]">
              {settings?.currency ?? 'USD'}
            </span>
          </div>
          <p className="mt-3 text-caption text-ink-faint">{t('settings.comingSoon')}</p>
        </section>

        <section className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/burgergo-logo.png"
            alt={t('mascot.alt')}
            width={88}
            height={88}
            className="mx-auto h-22 w-22 opacity-90"
          />
          <p className="mt-3 text-heading font-semibold text-ink">{t('app.name')}</p>
          <p className="mt-1 text-caption text-ink-muted">{t('settings.aboutTagline')}</p>
        </section>
      </main>
    );
  }
  ```

  > `getSettings` from `@/src/db/repos/settings` is contracted in group A2 and is synchronous. The page renders its language/currency read-only; the writable toggle is out of scope for Plan 1A.

- [ ] **Step 2: Verify it typechecks.**
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors for `app/(home)/settings/page.tsx`.

- [ ] **Step 3: Commit.**
  ```bash
  git add app/\(home\)/settings/page.tsx
  git commit -m "feat(settings): minimal read-only Settings placeholder page"
  ```

---

### Task A3.10: Trip shell layout + redirect page

**Files:**
- Create: `app/trip/[tripId]/layout.tsx`
- Create: `app/trip/[tripId]/page.tsx`
- Create: `components/TripHeader.tsx`
- Test: `components/TripHeader.test.tsx`

The shell `layout.tsx` (server) loads the trip, renders a warm header (back chevron → Home, name that taps to rename, date subtitle) via the `TripHeader` client component, and the persistent `BottomTabBar`. `page.tsx` redirects to `./plan` (Active → today's date; else start_date) using `tripStatus`/`deriveDays` and the `TZ` env.

- [ ] **Step 1: Write the failing test for TripHeader.**
  Create `components/TripHeader.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  }));
  vi.mock('@/app/_actions/trips', () => ({
    createTripAction: vi.fn(),
    renameTripAction: vi.fn(),
  }));

  import { TripHeader } from './TripHeader';

  function renderHeader() {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TripHeader tripId="t1" name="Tokyo adventure" dateSubtitle="May 3 – May 9" />
      </NextIntlClientProvider>,
    );
  }

  beforeEach(() => vi.clearAllMocks());

  describe('TripHeader', () => {
    it('renders the name, subtitle, and a back link to Home', () => {
      renderHeader();
      expect(screen.getByText('Tokyo adventure')).toBeInTheDocument();
      expect(screen.getByText('May 3 – May 9')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: en.trip.back }).getAttribute('href')).toBe('/');
    });

    it('opens the rename sheet when the name is tapped', async () => {
      renderHeader();
      await userEvent.click(screen.getByRole('button', { name: 'Tokyo adventure' }));
      expect(screen.getByRole('dialog', { name: en.renameSheet.title })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/TripHeader.test.tsx
  ```
  Expected: FAIL — `Failed to resolve import "./TripHeader"`.

- [ ] **Step 3: Implement TripHeader.**
  Create `components/TripHeader.tsx`:
  ```tsx
  'use client';

  import { useState } from 'react';
  import Link from 'next/link';
  import { useTranslations } from 'next-intl';
  import { RenameSheet } from '@/components/RenameSheet';

  type TripHeaderProps = {
    tripId: string;
    name: string;
    dateSubtitle: string;
  };

  export function TripHeader({ tripId, name, dateSubtitle }: TripHeaderProps) {
    const t = useTranslations();
    const [renameOpen, setRenameOpen] = useState(false);

    return (
      <header className="flex items-center gap-2 px-2 py-3">
        <Link
          href="/"
          aria-label={t('trip.back')}
          className="flex h-11 w-11 items-center justify-center rounded-chip text-ink"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setRenameOpen(true)}
            className="block max-w-full truncate text-left text-title font-bold text-ink"
          >
            {name}
          </button>
          <p className="truncate text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
            {dateSubtitle}
          </p>
        </div>

        <RenameSheet
          open={renameOpen}
          tripId={tripId}
          currentName={name}
          onClose={() => setRenameOpen(false)}
        />
      </header>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/TripHeader.test.tsx
  ```
  Expected: PASS — ~2 tests.

- [ ] **Step 5: Create the trip shell layout (server).**
  Create `app/trip/[tripId]/layout.tsx`:
  ```tsx
  import { notFound } from 'next/navigation';
  import { db } from '@/src/db/client';
  import { getTrip } from '@/src/db/repos/trips';
  import { TripHeader } from '@/components/TripHeader';
  import { BottomTabBar } from '@/components/BottomTabBar';

  function formatSubtitle(startDate: string, endDate: string): string {
    const fmt = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
    const end = fmt.format(new Date(`${endDate}T00:00:00Z`));
    return `${start} – ${end}`;
  }

  export default async function TripLayout({
    children,
    params,
  }: {
    children: React.ReactNode;
    params: Promise<{ tripId: string }>;
  }) {
    const { tripId } = await params;
    const trip = getTrip(db, tripId); // getTrip is synchronous
    if (!trip) notFound();

    return (
      <div className="min-h-screen pb-20">
        <TripHeader
          tripId={trip.id}
          name={trip.name}
          dateSubtitle={formatSubtitle(trip.startDate, trip.endDate)}
        />
        {children}
        <BottomTabBar tripId={trip.id} />
      </div>
    );
  }
  ```

- [ ] **Step 6: Create the redirect page (server).**
  Create `app/trip/[tripId]/page.tsx`:
  ```tsx
  import { redirect, notFound } from 'next/navigation';
  import { db } from '@/src/db/client';
  import { getTrip } from '@/src/db/repos/trips';
  import { tripStatus } from '@/src/lib/days';
  import { env } from '@/src/env';

  export const dynamic = 'force-dynamic';

  export default async function TripIndexPage({
    params,
  }: {
    params: Promise<{ tripId: string }>;
  }) {
    const { tripId } = await params;
    const trip = getTrip(db, tripId); // getTrip is synchronous
    if (!trip) notFound();

    // Active → today (container TZ); else explicit Day 1 (start_date). §3.8 / §8.1.
    const status = tripStatus(trip, env.TZ);
    const date =
      status === 'active'
        ? new Intl.DateTimeFormat('en-CA', { timeZone: env.TZ }).format(new Date())
        : trip.startDate;

    redirect(
      `/trip/${tripId}/plan?view=list&bucket=days&date=${date}`,
    );
  }
  ```

  > `Intl.DateTimeFormat('en-CA')` yields `YYYY-MM-DD`, matching `deriveDays`/`tripStatus`'s TZ-aware "today" convention from `@/src/lib/days`.

- [ ] **Step 7: Verify the server files typecheck.**
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors for `app/trip/[tripId]/layout.tsx` or `app/trip/[tripId]/page.tsx`.

- [ ] **Step 8: Commit.**
  ```bash
  git add app/trip/\[tripId\]/layout.tsx app/trip/\[tripId\]/page.tsx components/TripHeader.tsx components/TripHeader.test.tsx
  git commit -m "feat(trip): trip shell (header + tab bar) and active-aware plan redirect"
  ```

---

### Task A3.11: Placeholder tab pages (plan, eats, budget, journal)

**Files:**
- Create: `app/trip/[tripId]/plan/page.tsx`
- Create: `app/trip/[tripId]/eats/page.tsx`
- Create: `app/trip/[tripId]/budget/page.tsx`
- Create: `app/trip/[tripId]/journal/page.tsx`
- Verify: typecheck (server pages rendering the shared `EmptyState`)

Each tab page renders the mascot `EmptyState` "coming soon" so the shell is fully navigable. Real tab UIs come in later plans. All strings from `messages/en.json`. `EmptyState` is a client component, so these server pages render it without passing the (optional) action handler.

- [ ] **Step 1: Create the Plan placeholder.**
  Create `app/trip/[tripId]/plan/page.tsx`:
  ```tsx
  import { getTranslations } from 'next-intl/server';
  import { EmptyState } from '@/components/EmptyState';

  export default async function PlanPage() {
    const t = await getTranslations();
    return (
      <EmptyState
        mascotAlt={t('mascot.alt')}
        headline={t('comingSoon.plan')}
        subtext={t('comingSoon.subtext')}
      />
    );
  }
  ```

- [ ] **Step 2: Create the Eats placeholder.**
  Create `app/trip/[tripId]/eats/page.tsx`:
  ```tsx
  import { getTranslations } from 'next-intl/server';
  import { EmptyState } from '@/components/EmptyState';

  export default async function EatsPage() {
    const t = await getTranslations();
    return (
      <EmptyState
        mascotAlt={t('mascot.alt')}
        headline={t('comingSoon.eats')}
        subtext={t('comingSoon.subtext')}
      />
    );
  }
  ```

- [ ] **Step 3: Create the Budget placeholder.**
  Create `app/trip/[tripId]/budget/page.tsx`:
  ```tsx
  import { getTranslations } from 'next-intl/server';
  import { EmptyState } from '@/components/EmptyState';

  export default async function BudgetPage() {
    const t = await getTranslations();
    return (
      <EmptyState
        mascotAlt={t('mascot.alt')}
        headline={t('comingSoon.budget')}
        subtext={t('comingSoon.subtext')}
      />
    );
  }
  ```

- [ ] **Step 4: Create the Journal placeholder.**
  Create `app/trip/[tripId]/journal/page.tsx`:
  ```tsx
  import { getTranslations } from 'next-intl/server';
  import { EmptyState } from '@/components/EmptyState';

  export default async function JournalPage() {
    const t = await getTranslations();
    return (
      <EmptyState
        mascotAlt={t('mascot.alt')}
        headline={t('comingSoon.journal')}
        subtext={t('comingSoon.subtext')}
      />
    );
  }
  ```

- [ ] **Step 5: Verify all four pages typecheck.**
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors for any of the four tab pages (`@/components/EmptyState` and `next-intl/server` resolve).

- [ ] **Step 6: Commit.**
  ```bash
  git add app/trip/\[tripId\]/plan/page.tsx app/trip/\[tripId\]/eats/page.tsx app/trip/\[tripId\]/budget/page.tsx app/trip/\[tripId\]/journal/page.tsx
  git commit -m "feat(trip): placeholder plan/eats/budget/journal tabs with coming-soon empty states"
  ```

---

### Task A3.12: Full-group verification

**Files:** none (verification only)

Confirm the whole A3 surface — all components, layouts, pages, i18n — passes the unit suite and typechecks together before handing off.

- [ ] **Step 1: Run the full Vitest suite.**
  ```bash
  npm run test
  ```
  Expected: PASS — all A3 test files green (`i18n/request.test.ts`, `components/EmptyState.test.tsx`, `components/TripCard.test.tsx`, `components/NewTripSheet.test.tsx`, `components/RenameSheet.test.tsx`, `components/BottomTabBar.test.tsx`, `components/HomeClient.test.tsx`, `components/TripHeader.test.tsx`) plus earlier groups' tests; 0 failures.

- [ ] **Step 2: Typecheck the project.**
  ```bash
  npx tsc --noEmit
  ```
  Expected: exit code 0, no errors.

- [ ] **Step 3: Lint the project.**
  ```bash
  npm run lint
  ```
  Expected: no errors (warnings from the intentional `no-img-element` disables are suppressed inline).

- [ ] **Step 4: Confirm no hardcoded visible strings slipped in.**
  ```bash
  grep -rnE '>[A-Za-z][A-Za-z ]{3,}<' components/*.tsx "app/(home)" "app/trip" --include='*.tsx' | grep -v '\.test\.' || echo "OK: no raw visible strings"
  ```
  Expected: only matches that are i18n `{t(...)}` interpolations or the single-char FAB `+`/SVG content — no literal English UI sentences. (The wordmark and glyphs are acceptable; sentence-like literals are not.)

- [ ] **Step 5: Commit the verification checkpoint (empty if clean).**
  ```bash
  git commit --allow-empty -m "test(a3): trips UI group green — suite + typecheck + lint pass"
  ```

---

### Task A4.1: PWA Web App Manifest (§7.1)

**Files:**
- Create: `public/manifest.webmanifest`
- Test: `public/manifest.webmanifest.test.ts`

- [ ] **Step 1: Write the failing test for the manifest.** Create `public/manifest.webmanifest.test.ts` with the full test code below. It parses the manifest JSON and asserts every spec §7.1 field and the exact icon set.

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, 'manifest.webmanifest'), 'utf8'),
);

describe('manifest.webmanifest', () => {
  it('declares the BurgerGo identity and standalone chrome', () => {
    expect(manifest.name).toBe('BurgerGo');
    expect(manifest.short_name).toBe('BurgerGo');
    expect(manifest.description).toBe('Your personal travel-planning assistant.');
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.lang).toBe('en');
    expect(manifest.dir).toBe('ltr');
  });

  it('uses the Sunset Wanderer splash + theme colors', () => {
    expect(manifest.background_color).toBe('#F5EEE1'); // Paper
    expect(manifest.theme_color).toBe('#EE5B3C'); // Coral
  });

  it('lists the generated icon set with any + maskable purposes', () => {
    expect(manifest.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ]);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** Run:
```
npx vitest run public/manifest.webmanifest.test.ts
```
Expected: FAIL with `ENOENT: no such file or directory, open '.../public/manifest.webmanifest'`.

- [ ] **Step 3: Create the manifest (minimal implementation).** Create `public/manifest.webmanifest` with this exact JSON (note: it is `.webmanifest`, so it must be valid JSON with no comments — the spec's `//` comments are dropped):

```json
{
  "name": "BurgerGo",
  "short_name": "BurgerGo",
  "description": "Your personal travel-planning assistant.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5EEE1",
  "theme_color": "#EE5B3C",
  "lang": "en",
  "dir": "ltr",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png", "purpose": "any" }
  ]
}
```

- [ ] **Step 4: Run the test, expect PASS.** Run:
```
npx vitest run public/manifest.webmanifest.test.ts
```
Expected: PASS — `3 passed`.

- [ ] **Step 5: Commit.** Run:
```
git add public/manifest.webmanifest public/manifest.webmanifest.test.ts
git commit -m "feat(pwa): add web app manifest (§7.1)"
```

---

### Task A4.2: Icon generation script (sharp) wired into build (§7.1, §10.1)

**Files:**
- Create: `scripts/gen-icons.ts`
- Test: `scripts/gen-icons.test.ts`
- Modify: `package.json` (scripts: `gen:icons`, `build`)

- [ ] **Step 1: Write the failing test for the icon generator.** Create `scripts/gen-icons.test.ts`. It runs the generator into a temp output dir and asserts every emitted file exists and is a valid PNG of the right dimensions (read back with sharp). The generator must export a pure `generateIcons({ source, publicDir })` so the test can target a temp dir.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateIcons } from './gen-icons';

const SOURCE = resolve(__dirname, '..', 'assets', 'burgergo-logo.png');
let outDir: string;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'burgergo-icons-'));
  await generateIcons({ source: SOURCE, publicDir: outDir });
});

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('generateIcons', () => {
  it('copies the served logo to <publicDir>/burgergo-logo.png', () => {
    expect(existsSync(join(outDir, 'burgergo-logo.png'))).toBe(true);
  });

  it.each([
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/maskable-192.png', 192],
    ['icons/maskable-512.png', 512],
    ['icons/apple-touch-icon.png', 180],
  ])('emits %s at %ipx square', async (rel, size) => {
    const file = join(outDir, rel);
    expect(existsSync(file)).toBe(true);
    const meta = await sharp(file).metadata();
    expect(meta.width).toBe(size);
    expect(meta.height).toBe(size);
    expect(meta.format).toBe('png');
  });

  it('renders maskable icons on the Paper safe-zone field (no full-bleed transparency)', async () => {
    // Maskable variants are flattened onto Paper #F5EEE1 so adaptive masks never clip the mascot.
    const { data, info } = await sharp(join(outDir, 'icons/maskable-512.png'))
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Sample the top-left corner pixel; it must be the opaque Paper field, not transparent.
    const channels = info.channels;
    const [r, g, b] = [data[0], data[1], data[2]];
    expect(r).toBe(0xf5);
    expect(g).toBe(0xee);
    expect(b).toBe(0xe1);
    if (channels === 4) expect(data[3]).toBe(255);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** Run:
```
npx vitest run scripts/gen-icons.test.ts
```
Expected: FAIL — `Cannot find module './gen-icons'` (the script does not exist yet).

- [ ] **Step 3: Implement the generator (full code).** Create `scripts/gen-icons.ts`. It copies the source to `public/burgergo-logo.png`, emits `any` icons (logo fit onto a Paper field) and `maskable` icons (logo shrunk into the ~80% safe zone on a Paper field), plus the 180px apple-touch icon. When run directly (`node`/`tsx`) it targets the real `public/` dir.

```ts
import { mkdir, copyFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PAPER = { r: 0xf5, g: 0xee, b: 0xe1, alpha: 1 }; // #F5EEE1

export interface GenerateIconsOptions {
  /** Source logo (the high-res original). */
  source: string;
  /** Output public dir root; files land at <publicDir>/burgergo-logo.png and <publicDir>/icons/*. */
  publicDir: string;
}

/** Render the logo centered onto a square Paper field at `size`px. `inset` shrinks it for maskable safe-zone. */
async function renderIcon(source: string, size: number, inset: number): Promise<Buffer> {
  const logoSize = Math.round(size * inset);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: PAPER },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

export async function generateIcons(opts: GenerateIconsOptions): Promise<void> {
  const { source, publicDir } = opts;
  const iconsDir = join(publicDir, 'icons');
  await mkdir(iconsDir, { recursive: true });

  // Served mascot art (also referenced by the SW CacheFirst rule and EmptyState).
  await copyFile(source, join(publicDir, 'burgergo-logo.png'));

  // "any" icons: logo fills most of the field (92%).
  const any = 0.92;
  // "maskable" icons: logo lives in the ~80% safe zone so Android masks never clip the mascot.
  const safe = 0.66;

  await Promise.all([
    renderIcon(source, 192, any).then((b) => sharp(b).toFile(join(iconsDir, 'icon-192.png'))),
    renderIcon(source, 512, any).then((b) => sharp(b).toFile(join(iconsDir, 'icon-512.png'))),
    renderIcon(source, 192, safe).then((b) => sharp(b).toFile(join(iconsDir, 'maskable-192.png'))),
    renderIcon(source, 512, safe).then((b) => sharp(b).toFile(join(iconsDir, 'maskable-512.png'))),
    renderIcon(source, 180, any).then((b) => sharp(b).toFile(join(iconsDir, 'apple-touch-icon.png'))),
  ]);
}

// CLI entrypoint: `node scripts/gen-icons.js` / `tsx scripts/gen-icons.ts`.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  generateIcons({
    source: join(root, 'assets', 'burgergo-logo.png'),
    publicDir: join(root, 'public'),
  })
    .then(() => console.log('gen-icons: wrote public/burgergo-logo.png + public/icons/*'))
    .catch((err) => {
      console.error('gen-icons failed:', err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run the test, expect PASS.** Run:
```
npx vitest run scripts/gen-icons.test.ts
```
Expected: PASS — `7 passed` (1 copy + 5 size cases + 1 maskable-field).

- [ ] **Step 5: Wire the script into package.json.** Add the `gen:icons` script and make `build` run it first. Open `package.json` and ensure the `scripts` block contains exactly these entries (merge with existing, do not drop earlier-group scripts):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "npm run gen:icons && next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "gen:icons": "tsx scripts/gen-icons.ts"
  }
}
```

- [ ] **Step 6: Verify the script runs end-to-end against the real public dir.** Run:
```
npx tsx scripts/gen-icons.ts && ls -1 public public/icons
```
Expected output includes:
```
gen-icons: wrote public/burgergo-logo.png + public/icons/*
```
and the listing shows `burgergo-logo.png`, `manifest.webmanifest`, and under `public/icons`: `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png`.

- [ ] **Step 7: Commit.** The generated PNGs are build artifacts and must NOT be committed (they regenerate on build). Add them to `.gitignore`, then commit the script + test + package.json. Run:
```
printf '\n# generated by scripts/gen-icons.ts\npublic/burgergo-logo.png\npublic/icons/\n' >> .gitignore
git add scripts/gen-icons.ts scripts/gen-icons.test.ts package.json .gitignore
git commit -m "feat(pwa): generate PWA icons from logo with sharp, wire into build (§7.1)"
```

---

### Task A4.3: Serwist service worker source (`app/sw.ts`) (§7.2, §7.3)

**Files:**
- Create: `app/sw.ts`
- Test: `app/sw.test.ts`

- [ ] **Step 1: Write the failing test for the runtime-caching config.** The `app/sw.ts` file's top-level Serwist bootstrap can't run in jsdom (no `ServiceWorkerGlobalScope`). So we factor the routing policy into a pure, importable `buildRuntimeCaching()` that returns the runtime-caching entry list, and test that. Create `app/sw.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRuntimeCaching } from './sw';

function matcher(name: string) {
  const entry = buildRuntimeCaching().find((e) => e.name === name);
  if (!entry) throw new Error(`no runtimeCaching entry named ${name}`);
  return entry;
}

function matches(name: string, url: string): boolean {
  const entry = matcher(name);
  const request = new Request(url);
  return Boolean(
    entry.matcher({
      url: new URL(url),
      request,
      sameOrigin: new URL(url).origin === 'https://app.example.com',
    }),
  );
}

describe('buildRuntimeCaching', () => {
  it('SWR-caches trip-data + settings JSON under burgergo-data', () => {
    const entry = matcher('data');
    expect(entry.handler).toBe('StaleWhileRevalidate');
    expect(entry.options.cacheName).toBe('burgergo-data');
    expect(matches('data', 'https://app.example.com/api/trips')).toBe(true);
    expect(matches('data', 'https://app.example.com/api/trips/abc-123')).toBe(true);
    expect(matches('data', 'https://app.example.com/api/settings')).toBe(true);
    expect(matches('data', 'https://app.example.com/api/health')).toBe(false);
  });

  it('CacheFirst-caches logo, icons, and uploaded photos under burgergo-photos', () => {
    const entry = matcher('photos');
    expect(entry.handler).toBe('CacheFirst');
    expect(entry.options.cacheName).toBe('burgergo-photos');
    expect(matches('photos', 'https://app.example.com/burgergo-logo.png')).toBe(true);
    expect(matches('photos', 'https://app.example.com/icons/icon-192.png')).toBe(true);
    expect(matches('photos', 'https://app.example.com/api/photos/p1/card')).toBe(true);
    expect(matches('photos', 'https://app.example.com/api/trips')).toBe(false);
  });

  it('NetworkOnly for the Google proxy and Google/Maps origins', () => {
    const entry = matcher('google');
    expect(entry.handler).toBe('NetworkOnly');
    expect(matches('google', 'https://app.example.com/api/google/details')).toBe(true);
    expect(matches('google', 'https://maps.googleapis.com/maps/api/js')).toBe(true);
    expect(matches('google', 'https://maps.gstatic.com/tile.png')).toBe(true);
    expect(matches('google', 'https://app.example.com/api/trips')).toBe(false);
  });

  it('orders google (NetworkOnly) before data so /api/google/* is never SWR-cached', () => {
    const names = buildRuntimeCaching().map((e) => e.name);
    expect(names.indexOf('google')).toBeLessThan(names.indexOf('data'));
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** Run:
```
npx vitest run app/sw.test.ts
```
Expected: FAIL — `Cannot find module './sw'` / `buildRuntimeCaching is not a function`.

- [ ] **Step 3: Implement `app/sw.ts` (full code).** It exports the pure `buildRuntimeCaching()` (tested above), then runs the Serwist bootstrap with `injectManifest` precache + that runtime caching. Note: `google` is listed BEFORE `data`/`photos` so the NetworkOnly rule wins for `/api/google/*`.

```ts
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time with the real, build-hashed precache list.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

/**
 * Runtime caching policy (spec §7.3). Pure + exported so it is unit-testable without a SW global.
 * Order matters: `google` (NetworkOnly) is first so /api/google/* never falls through to SWR.
 */
export function buildRuntimeCaching(): RuntimeCaching[] {
  return [
    {
      name: 'google',
      handler: 'NetworkOnly',
      matcher({ url }) {
        return (
          url.pathname.startsWith('/api/google') ||
          /(^|\.)googleapis\.com$/.test(url.hostname) ||
          /(^|\.)gstatic\.com$/.test(url.hostname) ||
          url.hostname === 'maps.google.com'
        );
      },
    },
    {
      name: 'photos',
      handler: 'CacheFirst',
      matcher({ url }) {
        return (
          url.pathname === '/burgergo-logo.png' ||
          url.pathname.startsWith('/icons/') ||
          /^\/api\/photos\/[^/]+\/[^/]+$/.test(url.pathname)
        );
      },
      options: {
        cacheName: 'burgergo-photos',
        expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      name: 'data',
      handler: 'StaleWhileRevalidate',
      matcher({ url }) {
        return url.pathname.startsWith('/api/trips') || url.pathname === '/api/settings';
      },
      options: {
        cacheName: 'burgergo-data',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ];
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...buildRuntimeCaching(), ...defaultCache],
});

serwist.addEventListeners();
```

- [ ] **Step 4: Run the test, expect PASS.** Run:
```
npx vitest run app/sw.test.ts
```
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit.** Run:
```
git add app/sw.ts app/sw.test.ts
git commit -m "feat(pwa): Serwist SW source with SWR data / CacheFirst photos / NetworkOnly google (§7.3)"
```

---

### Task A4.4: next.config Serwist wiring → emit `public/sw.js` (§7.2, §10.1)

**Files:**
- Create: `next.config.ts` (replace any earlier-group stub by merging — see Step 1)
- Verification only (config is infra; no unit test)

- [ ] **Step 1: Write the full `next.config.ts`.** Wrap the base config with `@serwist/next` so it compiles `app/sw.ts` → `public/sw.js` with the injected precache manifest, and keep `output: 'standalone'` for the Docker runner. If an earlier group already created `next.config.ts` with `output: 'standalone'`, fold its contents into the `nextConfig` object below rather than duplicating the file.

```ts
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

const withSerwist = withSerwistInit({
  // Compile app/sw.ts → public/sw.js with the build-hashed precache manifest stamped in (§7.2).
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Don't generate the SW during `next dev` test runs / hot reload; it is produced for `next build`.
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
```

- [ ] **Step 2: Verify the SW is emitted by a real build.** This is the authoritative check that wiring works. Run:
```
npm run build
```
Expected: the build completes (`✓ Compiled successfully`) and Serwist logs a line like `> [PWA] Service worker: .../public/sw.js`. Then verify the artifact and the injected precache manifest:
```
test -f public/sw.js && echo "sw.js: OK"
grep -c "burgergo-data" public/sw.js
```
Expected:
```
sw.js: OK
```
and the `grep -c` prints a number `>= 1` (the runtime-caching cache name made it into the bundle).

- [ ] **Step 3: Ignore the generated SW artifacts and commit the config.** `public/sw.js` (+ `public/sw.js.map`) are build outputs; do not commit them. Run:
```
printf '\n# generated by @serwist/next\npublic/sw.js\npublic/sw.js.map\npublic/swe-worker-*.js\n' >> .gitignore
git add next.config.ts .gitignore
git commit -m "feat(pwa): wire @serwist/next to compile app/sw.ts to public/sw.js (§7.2)"
```

---

### Task A4.5: `components/SWRegister.tsx` — register SW + persist storage (§7.2, §7.3)

**Files:**
- Create: `components/SWRegister.tsx`
- Test: `components/SWRegister.test.tsx`

- [ ] **Step 1: Write the failing RTL test.** Create `components/SWRegister.test.tsx`. It stubs `navigator.serviceWorker.register` and `navigator.storage.persist`, mounts the component, fires the `load` event, and asserts `/sw.js` was registered and `persist()` called. It is a render-null client component.

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SWRegister } from './SWRegister';

describe('SWRegister', () => {
  const register = vi.fn().mockResolvedValue({ scope: '/' });
  const persist = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      serviceWorker: { register },
      storage: { persist },
    });
    register.mockClear();
    persist.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing', () => {
    const { container } = render(<SWRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it('registers /sw.js and requests persistent storage after window load', async () => {
    render(<SWRegister />);
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
    await waitFor(() => expect(persist).toHaveBeenCalled());
  });

  it('does not throw when service workers are unavailable', () => {
    vi.stubGlobal('navigator', {});
    expect(() => {
      render(<SWRegister />);
      window.dispatchEvent(new Event('load'));
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** Run:
```
npx vitest run components/SWRegister.test.tsx
```
Expected: FAIL — `Cannot find module './SWRegister'`.

- [ ] **Step 3: Implement `components/SWRegister.tsx` (full code).** Register after `load` so SW work never competes with first paint; then call `navigator.storage.persist()` (§7.3) so the trip cache resists eviction.

```tsx
'use client';

import { useEffect } from 'react';

/**
 * Registers the Serwist-built service worker (/sw.js) after first load and asks the browser
 * to persist storage so the offline trip cache resists eviction (spec §7.2, §7.3).
 * Renders nothing.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(() => {
          /* persistence is best-effort */
        });
      }
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
```

- [ ] **Step 4: Run the test, expect PASS.** Run:
```
npx vitest run components/SWRegister.test.tsx
```
Expected: PASS — `3 passed`.

- [ ] **Step 5: Commit.** Run:
```
git add components/SWRegister.tsx components/SWRegister.test.tsx
git commit -m "feat(pwa): SWRegister registers /sw.js and persists storage (§7.2)"
```

---

### Task A4.6: `components/OfflineBanner.tsx` — online/offline banner (§3.7, §7.6)

**Files:**
- Create: `components/OfflineBanner.tsx`
- Test: `components/OfflineBanner.test.tsx`

- [ ] **Step 1: Write the failing RTL test.** Create `components/OfflineBanner.test.tsx`. It wraps the component in `NextIntlClientProvider` with the en messages, toggles `navigator.onLine` + fires `offline`/`online` events, and asserts the Teal banner shows offline and hides online. It also asserts the banner text comes from messages (not hardcoded) and that the Teal `#4F8A86` color token is applied. The `offline.banner` string is defined in `messages/en.json` by group A3; this group only consumes it.

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { OfflineBanner } from './OfflineBanner';
import messages from '../messages/en.json';

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OfflineBanner />
    </NextIntlClientProvider>,
  );
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('OfflineBanner', () => {
  beforeEach(() => setOnline(true));
  afterEach(() => setOnline(true));

  it('is hidden while online', () => {
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the localized Teal banner when going offline', () => {
    renderBanner();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(messages.offline.banner);
    // Teal strip (spec §3.7 / §9.2).
    expect(banner).toHaveStyle({ backgroundColor: '#4F8A86' });
  });

  it('renders offline immediately if the page mounts already offline', () => {
    setOnline(false);
    renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides again when connectivity returns', () => {
    setOnline(false);
    renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** Run:
```
npx vitest run components/OfflineBanner.test.tsx
```
Expected: FAIL — `Cannot find module './OfflineBanner'`.

- [ ] **Step 3: Implement `components/OfflineBanner.tsx` (full code).** Client component: tracks `navigator.onLine`, subscribes to `online`/`offline`, renders nothing online and a Teal `#4F8A86` strip offline with `role="status"`, copy from `messages` via `useTranslations('offline')`. Seeds state from `navigator.onLine` after mount (avoids SSR hydration mismatch).

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Standardized connectivity banner (spec §3.7, §7.6). Driven by navigator.onLine +
 * 'online'/'offline' events. Teal strip; copy from messages (bilingual-ready). Hidden online.
 */
export function OfflineBanner() {
  const t = useTranslations('offline');
  // Start "online" so SSR markup is empty and hydration matches; correct on mount.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ backgroundColor: '#4F8A86' }}
      className="w-full px-4 py-2 text-center text-sm font-medium text-white"
    >
      {t('banner')}
    </div>
  );
}
```

- [ ] **Step 4: Run the test, expect PASS.** Run:
```
npx vitest run components/OfflineBanner.test.tsx
```
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit.** Run:
```
git add components/OfflineBanner.tsx components/OfflineBanner.test.tsx
git commit -m "feat(pwa): OfflineBanner driven by online/offline events with Teal strip (§3.7, §7.6)"
```

---

### Task A4.7: `.dockerignore` (§10.1)

**Files:**
- Create: `.dockerignore`
- Verification only (infra)

- [ ] **Step 1: Write the full `.dockerignore`.** Keep the build context small and avoid copying host artifacts that would shadow the in-image build. Create `.dockerignore`:

```
node_modules
.next
.git
.gitignore
npm-debug.log*
Dockerfile
docker-compose.yml
.dockerignore
.env
.env.*
!.env.example
*.md
docs
.superpowers
coverage
.vscode
.idea
.DS_Store
# generated artifacts are rebuilt inside the image
public/sw.js
public/sw.js.map
public/swe-worker-*.js
public/burgergo-logo.png
public/icons
```

- [ ] **Step 2: Verify it parses and excludes node_modules.** A quick sanity check that the file lists the key exclusions:
```
grep -qx 'node_modules' .dockerignore && grep -qx '.next' .dockerignore && echo ".dockerignore: OK"
```
Expected:
```
.dockerignore: OK
```

- [ ] **Step 3: Commit.** Run:
```
git add .dockerignore
git commit -m "build(docker): add .dockerignore (§10.1)"
```

---

### Task A4.8: `.env.example` (§10.3)

**Files:**
- Create: `.env.example`
- Verification only (infra)

- [ ] **Step 1: Write the full `.env.example`.** Documents every var from spec §10.3 with the contracted defaults; secrets blank. Create `.env.example`:

```sh
# BurgerGo environment (copy to .env next to docker-compose.yml; never commit .env)

# SQLite database file inside the container (on the burgergo-db volume).
DATABASE_PATH=/data/burgergo.db

# Resized photo storage root (on the burgergo-uploads volume).
UPLOADS_DIR=/data/uploads

# Browser key: Maps JS + Places Autocomplete. Restrict by HTTP referrer to your origin.
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Server key: Place Details, Directions, reverse-geocode, Photos. Restrict by IP; never sent to client.
GOOGLE_MAPS_SERVER_KEY=

# Seeds settings.currency on first boot (ISO 4217). Default USD.
DEFAULT_CURRENCY=USD

# Seeds settings.language on first boot (en | zh). Default en.
DEFAULT_LANGUAGE=en

# Container timezone — drives "today" detection consistently on server + client. Default UTC.
TZ=UTC
```

- [ ] **Step 2: Verify it contains every required key.** Run:
```
for k in DATABASE_PATH UPLOADS_DIR NEXT_PUBLIC_GOOGLE_MAPS_API_KEY GOOGLE_MAPS_SERVER_KEY DEFAULT_CURRENCY DEFAULT_LANGUAGE TZ; do grep -q "^$k=" .env.example || echo "MISSING $k"; done; echo "env-check done"
```
Expected:
```
env-check done
```
(no `MISSING` lines).

- [ ] **Step 3: Commit.** Run:
```
git add .env.example
git commit -m "build(docker): add .env.example documenting all env vars (§10.3)"
```

---

### Task A4.9: `docker-entrypoint.sh` — migrate then start (§10.5)

**Files:**
- Create: `docker-entrypoint.sh`
- Verification only (infra)

- [ ] **Step 1: Write the full `docker-entrypoint.sh`.** Runs the programmatic migrator (`scripts/migrate.ts` compiled to `scripts/migrate.js` and committed by an earlier group — see DB CONTRACT) BEFORE serving, with no fallback masking a migration failure. Create `docker-entrypoint.sh`:

```sh
#!/bin/sh
# BurgerGo container entrypoint (spec §10.5).
# Applies pending Drizzle migrations against DATABASE_PATH (reading /app/drizzle) BEFORE
# the server accepts traffic. No "|| fallback": a failed migration exits non-zero and
# never serves a stale schema. Then exec the Next.js standalone server.
set -e

echo "burgergo: applying database migrations..."
node ./scripts/migrate.js

echo "burgergo: starting server..."
exec "$@"
```

- [ ] **Step 2: Make it executable and verify it is a valid POSIX script.** Run:
```
chmod +x docker-entrypoint.sh
sh -n docker-entrypoint.sh && echo "entrypoint syntax: OK"
```
Expected:
```
entrypoint syntax: OK
```

- [ ] **Step 3: Commit (preserve the executable bit).** Run:
```
git add docker-entrypoint.sh
git update-index --chmod=+x docker-entrypoint.sh
git commit -m "build(docker): entrypoint migrates then starts server (§10.5)"
```

---

### Task A4.10: Multi-stage `Dockerfile` (§10.1)

**Files:**
- Create: `Dockerfile`
- Verification only (infra)

- [ ] **Step 1: Write the full multi-stage `Dockerfile`.** Three stages per spec §10.1: `deps` (build toolchain for `better-sqlite3`, `npm ci`), `builder` (`npm run build` → standalone + icons + sw.js; `drizzle-kit generate` baked into `/app/drizzle`), `runner` (clean slim glibc image, non-root, copies only runtime artifacts). Create `Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

# 1) deps — install with the native toolchain so better-sqlite3 (node-gyp) builds against glibc.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# 2) builder — compile the app: standalone server, static assets, icons, Serwist sw.js,
#    and the committed/generated drizzle SQL migrations baked into /app/drizzle.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Bake SQL migrations into the image (committed under drizzle/, regenerate to be safe).
RUN npm run db:generate
# build runs gen:icons then next build (output: standalone), which also emits public/sw.js.
RUN npm run build

# 3) runner — clean glibc slim image. Non-root. Only the runtime artifacts.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN useradd -m -u 1001 burgergo
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh
RUN mkdir -p /data /data/uploads && chown -R burgergo /data
USER burgergo
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

Note on the extra `better-sqlite3` copy: the standalone trace already includes the app's traced `node_modules`, but `scripts/migrate.js` runs OUTSIDE Next's traced graph at container start, so its `better-sqlite3` native binding is copied explicitly to guarantee the migrator boots.

- [ ] **Step 2: Verify the image builds end-to-end.** This is the authoritative infra check. Run:
```
docker build -t burgergo:ci .
```
Expected: the build runs all three stages and ends with `=> => naming to docker.io/library/burgergo:ci` / `Successfully tagged burgergo:ci` (no error). If Docker is unavailable in the dev environment, instead run a structural lint and record that CI must run the real build:
```
docker build --check . 2>/dev/null || echo "docker unavailable here — Dockerfile committed; full build runs in CI"
```

- [ ] **Step 3: Commit.** Run:
```
git add Dockerfile
git commit -m "build(docker): multi-stage Dockerfile (deps/builder/runner) for standalone Next + better-sqlite3 (§10.1)"
```

---

### Task A4.11: `docker-compose.yml` (§10.2)

**Files:**
- Create: `docker-compose.yml`
- Verification only (infra)

- [ ] **Step 1: Write the full `docker-compose.yml`.** Exactly per spec §10.2: one `app` service, two named volumes, env passthrough, `/api/health` healthcheck. Create `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    image: burgergo:latest
    restart: unless-stopped
    ports:
      - "3000:3000" # bound behind the user's own TLS reverse proxy
    environment:
      DATABASE_PATH: /data/burgergo.db
      UPLOADS_DIR: /data/uploads
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      GOOGLE_MAPS_SERVER_KEY: ${GOOGLE_MAPS_SERVER_KEY}
      DEFAULT_CURRENCY: ${DEFAULT_CURRENCY:-USD}
      DEFAULT_LANGUAGE: ${DEFAULT_LANGUAGE:-en}
      TZ: ${TZ:-UTC}
    volumes:
      - burgergo-db:/data
      - burgergo-uploads:/data/uploads
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  burgergo-db:
  burgergo-uploads:
```

- [ ] **Step 2: Verify the compose file is valid and resolves the service.** Run:
```
docker compose config >/dev/null && echo "compose: OK" || echo "docker compose unavailable here — file committed; CI validates"
```
Expected:
```
compose: OK
```
(or the fallback message if Docker is unavailable in this environment).

- [ ] **Step 3: Commit.** Run:
```
git add docker-compose.yml
git commit -m "build(docker): docker-compose with app service + db/uploads volumes + health check (§10.2)"
```

---

### Task A4.12: End-to-end container smoke test — health + offline cache (§10.2, §7.3)

**Files:**
- No new source. Verification only — exercises everything A4 produced together with the read handlers and migrator from earlier groups.

- [ ] **Step 1: Bring the stack up against ephemeral volumes.** From the repo root with a `.env` present (copy from `.env.example`), run:
```
cp -n .env.example .env || true
docker compose up -d --build
```
Expected: `docker compose up` builds (if needed) and starts the `app` container; the entrypoint logs `burgergo: applying database migrations...` then `burgergo: starting server...`.

- [ ] **Step 2: Wait for the health check to pass, then curl `/api/health`.** Run:
```
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)")" = "healthy" ]; do sleep 2; done
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health
curl -s http://localhost:3000/api/health
```
Expected: the inspect loop exits once healthy; the first curl prints `200`; the second prints `{"status":"ok"}` (from the `/api/health` handler in an earlier group, which runs `SELECT 1`).

- [ ] **Step 2.5: Confirm the trips read endpoint serves JSON (the SW's SWR target).** Run:
```
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3000/api/trips
```
Expected: `200 application/json` (empty list `[]` on a fresh volume), confirming the endpoint the SW caches under `burgergo-data` is live.

- [ ] **Step 3: Confirm the SW and PWA assets are served.** Run:
```
curl -s -o /dev/null -w 'sw=%{http_code}\n' http://localhost:3000/sw.js
curl -s -o /dev/null -w 'manifest=%{http_code}\n' http://localhost:3000/manifest.webmanifest
curl -s -o /dev/null -w 'logo=%{http_code}\n' http://localhost:3000/burgergo-logo.png
curl -s -o /dev/null -w 'icon=%{http_code}\n' http://localhost:3000/icons/icon-192.png
```
Expected:
```
sw=200
manifest=200
logo=200
icon=200
```

- [ ] **Step 4: Confirm migrations are idempotent on restart (§10.5).** Run:
```
docker compose restart app
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)")" = "healthy" ]; do sleep 2; done
curl -s http://localhost:3000/api/health
```
Expected: the container restarts cleanly (re-running migrations is a no-op against the persisted `burgergo-db` volume) and `/api/health` again returns `{"status":"ok"}`.

- [ ] **Step 5: Tear down.** Run:
```
docker compose down -v
```
Expected: the `app` container and the `burgergo-db` / `burgergo-uploads` volumes are removed.

- [ ] **Step 6: Commit the verification evidence (docs-free).** No files change in this step; if Docker was unavailable in the dev environment, record that this smoke test is a CI gate. There is nothing to commit unless prior steps were skipped. Run (no-op safe):
```
git status --porcelain
```
Expected: empty output (this group's source/config/test/infra files are all already committed in A4.1–A4.11).

---
