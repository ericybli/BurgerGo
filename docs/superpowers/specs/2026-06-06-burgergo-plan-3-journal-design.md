# BurgerGo Plan 3 — Journal & Settings polish (design spec)

**Status:** approved design (2026-06-06). This is the authoritative spec for Plan 3; an engineer should be able to turn it into an implementation plan without reading the chat. It builds on the merged-and-deployed Phase 1 (Plans 1A+1B) and Plan 2 (Eats/Budget/Photos), and on the master design spec `docs/superpowers/specs/2026-06-05-burgergo-design.md` (§4.3 Journal, §4.4 Settings, §5 data model). Where this spec and the master spec differ, **this spec wins** for Plan 3 scope.

---

## 1. Goal & scope

Complete the BurgerGo PWA's last planned feature surface: the **Journal** tab (`/trip/[tripId]/journal`) — a photo-rich entries feed plus a saved-links reading list — and finish the Settings **About** block.

**In scope**
- `journal_entries` + `saved_links` tables (migration `0003`) with pure repos.
- Journal tab UI: segmented **Entries ⇄ Reading list**; entry feed + reader; entry editor (markdown + photos); reading-list rows + add-link sheet with server-side OpenGraph preview.
- Online-only Server Actions for all journal mutations.
- `GET /api/trips/[tripId]/journal` read handler (entries+links).
- `POST /api/links/preview` (SSRF-guarded OpenGraph fetch) + `GET /api/links/thumb/[linkId]` thumbnail serve.
- Extend the existing `POST /api/photos` route to accept `ownerType='journal'`.
- Settings **About** block.

**Out of scope (explicit)**
- **No i18n.** The EN⇄中文 toggle is dropped. `i18n/request.ts` stays static-`en`; no zh bundle, no locale-switch architecture. New strings go in `messages/en.json` under a `journal` namespace (and the existing `settings` namespace for About).
- No onboarding flow, no a11y-sweep beyond what each new component needs, no currency/language settings work (still "coming soon").
- No offline editing (consistent with the whole app: mutations are online-only).

---

## 2. Conventions (unchanged — follow existing codebase)

- Repos are **pure**: `(db, ...args)` first arg; `type Db = TestDb['db']`; tested with in-memory `makeTestDb()`.
- IDs via `newId()` (`@/src/db/ids`); clock via `now()` (`@/src/lib/clock`); `{ mode: 'timestamp' }` columns store **Unix seconds** — write `new Date(now())`.
- Dates (`entry_date`) are `TEXT` `YYYY-MM-DD`.
- Pages that must be offline-readable are **static shells** (`export const dynamic = 'force-static'`) that client-fetch read APIs through `withBase('/api/...')` (`@/src/lib/basePath`). Mutations are online-only Server Actions, disabled in the UI when `!navigator.onLine`.
- Read API routes are `GET`; mutations never go through API routes (those return 405 by absence).
- Client fetches use `credentials: 'same-origin'`.
- Tests: Vitest + Testing Library; every new pure function/repo/handler unit-tested; client components tested with mocked actions/fetch; full suite + `tsc` + `lint` + `build` must stay green.

---

## 3. Data model — migration `0003`

Generate with `npm run db:generate` (drizzle-kit) after editing `src/db/schema.ts`; the migrator applies it on container start.

### 3.1 `journal_entries`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | `newId()` |
| trip_id | text FK→trips.id | no | `onDelete: 'cascade'` |
| title | text | no | required; the editor enforces non-empty (resolves the master spec's nullable/required ambiguity in favor of **required**) |
| body | text | no | markdown source; may be empty string |
| entry_date | text (YYYY-MM-DD) | yes | optional; editor defaults to today, clearable |
| created_at | integer ts | no | `new Date(now())` |
| updated_at | integer ts | no | bump on update |

Index: `idx_journal_trip_created (trip_id, created_at)` for newest-first listing.

Repo `src/db/repos/journalEntries.ts`: `getEntry / listByTrip / addEntry / updateEntry / deleteEntry`. `listByTrip` orders strictly by **`created_at DESC`** (newest-written first) — unambiguous regardless of whether `entry_date` is set. `entry_date` is display metadata only and does not affect feed order.

### 3.2 `saved_links`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| url | text | no | the saved URL |
| title | text | yes | editable; preview may prefill |
| note | text | yes | optional |
| thumbnail | text | yes | **relative path** of the downloaded OG image derivative on the uploads volume (no extension semantics beyond what the serve route expects); null if none |
| created_at / updated_at | integer ts | no | |

Index: `idx_links_trip (trip_id, created_at)`.

Repo `src/db/repos/savedLinks.ts`: `getLink / listByTrip (created_at desc) / addLink / updateLink / deleteLink`.

### 3.3 Photos (no schema change)
Journal entry photos reuse the **existing `photos` table** with `owner_type = 'journal'`, `owner_id = <entry id>`. The enum already includes `'journal'`. The Plan 2 pipeline, derivative paths (`<tripId>/<photoId>` base; thumb/card/full WebP), serve route, `PhotoGallery`, and `usePhotoUpload` are reused unchanged except the upload-route owner guard (§6.1).

---

## 4. Journal tab — Entries

**Page** `app/trip/[tripId]/journal/page.tsx`: replace the placeholder with `export const dynamic = 'force-static'` rendering `<JournalClient tripId=... />` (resolve `tripId` from params; static shell, no DB read).

**`components/journal/JournalClient.tsx`** (data owner, mirrors `BudgetClient`): online/offline tracking, mounted-ref guard, loading/error/loaded states. On load, fetches `GET /api/trips/[tripId]/journal`. A top segmented control switches **Entries ⇄ Reading list** (URL or local state; local state is fine since both sub-views share one fetch). Hosts the entry feed/reader/editor and the reading-list views below.

**Entries feed**: cards newest-first showing `title`, optional `entry_date` (+ weekday), a `body` snippet (plain-text excerpt derived from the markdown), and a photo-thumb strip when photos exist. Tap → **reader**. A Coral "+" opens the editor in add mode. Empty state: `EmptyState` ("No journal entries yet" / "Write about your day, add a few photos." / "New entry" action when online).

**Entry reader** (`components/journal/EntryReader.tsx`): renders the markdown `body` (see §4.1) and the entry's photos in the existing full-screen-tap-through `PhotoGallery`. All images are cached offline (served via `/api/photos/p/*`).

**Entry editor sheet** (`components/journal/EntrySheet.tsx`, bottom-sheet like `ExpenseSheet`): **Title** (required), **Entry date** (date input, defaults to today via the `en-CA` formatter idiom, clearable), **Body** (markdown editor, §4.1), **Photos**, **Save**, and in edit mode **Delete** (behind a confirm). Keyed to remount fresh per open (`key` includes open-state + entry id, namespaced — the Plan 2 stale-form fix). Disabled controls + offline notice when offline.

- **Photo attach flow**: photos require an entry `id`, so the control is enabled only in **edit mode** (after first save) — identical to how `PlaceDetailSheet` attaches photos. Add mode shows a hint that photos can be added after saving. Upload uses the existing `usePhotoUpload` hook / `POST /api/photos` with `ownerType='journal'`, `ownerId=<entry id>`. The gallery within the editor supports delete (✕) via `deletePhotoAction`.

### 4.1 Markdown
- **Editing**: a lightweight toolbar (Bold, Italic, Heading, List, Link) that inserts markdown syntax around the selection in a plain `<textarea>`; the stored value is markdown source. No heavy WYSIWYG.
- **Rendering**: `react-markdown` + `remark-gfm` + `rehype-sanitize` (sanitized, runs client-side so it works offline). Add these deps. A small wrapper component `components/journal/Markdown.tsx` centralizes the sanitize schema (allow standard inline/block formatting + links with `rel="noopener noreferrer"` `target="_blank"`; disallow raw HTML/scripts). Re-run `node scripts/fix-lockfile.mjs` after `npm install` (the sharp-musl lockfile guard).

---

## 5. Journal tab — Reading list

**Rows** (`components/journal/LinkRow.tsx`): `thumbnail` (or a Sun-tinted mascot fallback tile when null/offline-missing), `title` (or the URL host if no title), source domain (derived from `url`), and `note`. Tapping the row opens `url` in a new tab (`rel="noopener noreferrer"`). A ⋯ control offers **Edit / Delete**. Empty state: "No saved links yet" / "Save blogs and articles to read before your trip." / "Add link".

**Add/Edit link sheet** (`components/journal/LinkSheet.tsx`): **URL** (required), **Title** (editable), **Note** (optional), Save / (edit) Delete. Keyed-remount per open.
- On URL paste/blur (add mode, online), call `POST /api/links/preview` with the URL. On success, prefill `Title` (if empty) and stash the returned `thumbnailPath` to persist on save. Show a small inline "fetching preview…" state; failure or offline is non-fatal (user types the title, no thumbnail). The preview call is fire-and-forget UX — never blocks manual entry.
- On Save: `addLinkAction({ tripId, url, title, note, thumbnail })` (thumbnail = the preview path or null) / `updateLinkAction(id, patch)`.
- On Delete: `deleteLinkAction(id)` removes the row and best-effort deletes the thumbnail derivative file (path-traversal–guarded, §6.3).

---

## 6. Server actions, routes & security

All actions live under `app/_actions/` (`'use server'`), validate input with zod, call the pure repo with the shared `db`, and `revalidatePath('/trip/<tripId>/journal')`.

### 6.1 Extend `POST /api/photos` for journal owners
The route currently rejects `ownerType !== 'place'`. Extend it to also accept `ownerType === 'journal'`: when journal, validate that the owner is a `journal_entries` row belonging to `tripId` (mirror the place validation: 404 if missing or wrong trip), apply the same per-owner count cap, and insert with `ownerType:'journal'`. Keep all existing guards (content-type, size, sharp decode, pixel limit). Add tests for the journal-owner path.

### 6.2 Journal actions (`app/_actions/journal.ts`)
- `addEntryAction({ tripId, title, body, entryDate })` → title `min(1)`, body string (`max` large cap), entryDate optional `YYYY-MM-DD`. Returns the entry.
- `updateEntryAction(id, patch)` → partial; 404 if missing.
- `deleteEntryAction(id)` → deletes the entry **and** its journal photos: list `photos` by `('journal', id)`, remove each derivative dir (reusing the `deletePhotoAction` path-traversal guard — strictly under uploads root), delete the photo rows, then delete the entry. Revalidate.

### 6.3 Saved-link actions (`app/_actions/savedLinks.ts`)
- `addLinkAction({ tripId, url, title, note, thumbnail })` → url required (validated `http`/`https`), thumbnail optional path.
- `updateLinkAction(id, patch)` / `deleteLinkAction(id)` (delete best-effort removes the thumbnail file with the same path-traversal guard).

### 6.4 `POST /api/links/preview` — OpenGraph fetch (online-only, SSRF-guarded)
Input `{ url }`. Output `{ title?: string, thumbnailPath?: string }` or an error status. This is a **public** endpoint fetching a user-supplied URL, so it is hardened against SSRF:
- Accept only `http:`/`https:` URLs; reject otherwise (400).
- Resolve the host via DNS and **reject** if any resolved address is loopback, private (RFC1918), link-local, unique-local (IPv6 fc00::/7), CGNAT (100.64.0.0/10), or the cloud-metadata address `169.254.169.254`. Reject literal-IP URLs that fall in those ranges too.
- Fetch with a **5s timeout**, a **response-size cap** (e.g. 2 MB for the HTML), and **limited redirects** (≤3), re-validating the host of every redirect hop against the same blocklist.
- Require an HTML-ish content-type for the page fetch.
- Parse `og:title` / `<title>` and `og:image` from the HTML (use a small, server-only HTML parser — `node-html-parser` or `cheerio`; do not eval/execute anything).
- If an `og:image` is found: fetch it under the **same SSRF guards**, require an `image/*` content-type + size cap, run it through the existing sharp pipeline to produce a single resized WebP derivative, store it on the uploads volume under a link-thumbnail path (e.g. `<tripId>/links/<thumbId>`), and return its relative path as `thumbnailPath`.
- On any failure (timeout, blocked host, no tags, decode error): return a clean non-fatal result (e.g. `{}` with 200, or a 422) — the client treats it as "no preview."
- The route is `force-dynamic` (it does network I/O) and is **never** SW-cached (it's a POST).

### 6.5 `GET /api/links/thumb/[linkId]` — serve link thumbnail
Looks up the `saved_links` row, resolves its `thumbnail` path under `UPLOADS_DIR`, applies the **path-traversal guard** (resolve + `startsWith(root + sep)`, strictly under root), and streams the WebP with long-cache headers. 404 if the link or file is missing. (Alternative considered: fold link thumbnails into the `photos` table + existing serve route. Rejected — the master spec keeps `saved_links.thumbnail` as its own path column, and link thumbnails aren't gallery photos.)

### 6.6 `GET /api/trips/[tripId]/journal` — read handler
Returns `{ entries: EntryDTO[], links: SavedLink[] }`. `EntryDTO` = entry row + its photos (batch-load all journal photos for the trip's entries via `inArray(owner_id, entryIds)` filtered to `owner_type='journal'`, group in memory — **no N+1**). 404 if the trip is missing. `force-dynamic` route returning JSON (cached by the SW `data` matcher, which already covers `/api/trips/*`).

---

## 7. Offline / service worker

- **Journal read** (`/api/trips/[tripId]/journal`) — already matched by the SW `data` (StaleWhileRevalidate) entry (`startsWith('/api/trips')`). No SW change.
- **Journal photos** (`/api/photos/p/*`) — already `CacheFirst`. No change.
- **Link thumbnails** (`/api/links/thumb/*`) — **add** a matcher to the `photos` CacheFirst entry in `app/sw.ts` (`^${base}/api/links/thumb/[^/]+$`). Update the SW routing test.
- **Journal page shell** — static, cached by the `pages` NetworkFirst entry like other tabs.
- Preview (`POST /api/links/preview`) is online-only and uncached by design.

---

## 8. Settings — About block

In `components/SettingsClient.tsx`, finish the **About** section (the language/currency controls remain "coming soon" — untouched):
- Mascot + "BurgerGo" wordmark + one-line tagline (existing `settings.aboutTagline`).
- App version (read from `package.json` `version`, surfaced at build via a literal `process.env.NEXT_PUBLIC_*` or a small generated constant — pick the simplest that doesn't force-dynamic the route; a build-time inlined constant is preferred).
- Two quiet info rows: **Offline & install** ("works offline for reading; installing the app and using your location require HTTPS or localhost") and **Your data** ("all data lives in your own SQLite database on your server" + a one-line backup pointer).
- New `settings.*` strings added to `en.json`. Section is viewable offline (static shell already).

---

## 9. Strings

Add a `journal` namespace to `messages/en.json` covering: segmented labels (Entries / Reading list), feed + reader, editor fields and actions, empty states (entries + links), link sheet fields, preview states, validation/error messages, and the markdown toolbar labels. Add any new `settings` About strings. A keys-coverage test (like `messages/budget.keys.test.ts`) asserts every required key exists.

---

## 10. File structure (new/changed)

```
src/db/schema.ts                                  (+ journal_entries, saved_links)
drizzle/0003_*.sql, drizzle/meta/*                (generated)
src/db/repos/journalEntries.ts (+ .test.ts)
src/db/repos/savedLinks.ts (+ .test.ts)
src/lib/journalView.ts (+ .test.ts)               (snippet/domain/group helpers, pure)
src/lib/linkPreview.ts (+ .test.ts)               (URL validation + SSRF host guard, pure/unit-testable)
app/_actions/journal.ts (+ .test.ts)
app/_actions/savedLinks.ts (+ .test.ts)
app/api/photos/route.ts                           (extend: accept ownerType='journal') (+ tests)
app/api/links/preview/route.ts (+ .test.ts)
app/api/links/thumb/[linkId]/route.ts (+ .test.ts)
app/api/trips/[tripId]/journal/route.ts (+ .test.ts)
app/trip/[tripId]/journal/page.tsx (+ .test.tsx)  (replace placeholder)
components/journal/JournalClient.tsx (+ .test.tsx)
components/journal/EntrySheet.tsx (+ .test.tsx)
components/journal/EntryReader.tsx (+ .test.tsx)
components/journal/LinkRow.tsx (+ .test.tsx)
components/journal/LinkSheet.tsx (+ .test.tsx)
components/journal/Markdown.tsx (+ .test.tsx)
components/SettingsClient.tsx                      (About block) (+ test update)
app/sw.ts                                          (+ link-thumb matcher) (+ test update)
messages/en.json                                   (+ journal namespace, + settings About)
package.json                                       (+ react-markdown, remark-gfm, rehype-sanitize, html parser)
```

---

## 11. Task groups (for the implementation plan)

- **D0 — Schema & repos:** `journal_entries` + `saved_links` in schema, migration `0003`, pure repos + tests, `journalView`/`linkPreview` pure helpers + tests.
- **D1 — Entries:** extend `POST /api/photos` for journal; `journal` actions; `EntrySheet` (markdown editor + photos), `EntryReader` (Markdown render + gallery), feed in `JournalClient`; strings; tests.
- **D2 — Reading list & preview:** `savedLinks` actions; `POST /api/links/preview` (SSRF-guarded) + `GET /api/links/thumb/[linkId]`; `LinkRow` + `LinkSheet`; SW link-thumb matcher; tests (incl. SSRF-guard + redirect rejection).
- **D3 — Read handler, Settings About & wiring:** `GET /api/trips/[tripId]/journal` (batched photos, no N+1); replace journal page placeholder; Settings About block; full-suite/tsc/lint/build green gate; live browser smoke test before merge.

---

## 12. Success criteria

- Journal entries: create/read/update/delete with markdown body + photos; reader renders sanitized markdown and a cached photo gallery; all readable offline.
- Reading list: add/edit/delete links; online paste fetches a guarded OG preview (title + thumbnail) that is offline-cacheable; offline degrades to manual entry.
- SSRF guard verified by tests (private-IP/redirect rejection); markdown sanitization verified.
- Settings About block complete.
- Journal + Settings pages remain **static** (`○`) in the build; new reads SW-cached; mutations online-only.
- Full vitest suite + `tsc` + `lint` + `build` green; live browser smoke test passes; deployed via `./scripts/deploy.sh`.
