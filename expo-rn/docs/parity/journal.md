# journal parity spec

Source of truth: `/Users/eric/own/BurgerGo/components/journal/` (`JournalClient.tsx`, `EntryReader.tsx`, `EntrySheet.tsx`, `Markdown.tsx`, `LinkRow.tsx`, `LinkSheet.tsx`, `PhotographyTab.tsx`, `PhotoListSheet.tsx`), shared `components/plan/PhotoGallery.tsx` + `components/plan/usePhotoUpload.ts`, helpers `src/lib/journalView.ts`, strings `messages/en.json` → `journal.*`.
Target: `/Users/eric/own/BurgerGo/expo-rn/screens/journal/JournalScreen.tsx` + `expo-rn/lib/api/{index,types,client}.ts`.

## Web feature inventory (exhaustive)

### Top level (JournalClient)
- One fetch on mount: `GET /api/trips/{tripId}/journal` → `{ entries, links, photoLists }`. Every mutation calls `load()` again (full refetch — no optimistic updates).
- Loading text: `"Loading your journal…"` (centered, sub). Error empty-state: headline `"Couldn't load your journal"`, subtext `"Check your connection and try again."` (web has no retry button; RN seed's Retry is an acceptable superset).
- Online tracking (`navigator.onLine` ↔ RN `useOnline()`): offline disables ALL create/edit/delete/upload controls; sheets show `"You're offline — editing is paused until you reconnect."`
- Segmented control with **3** tabs, exact labels: `"Entries"` / `"Reading list"` / `"Photography"`. Track = surface bg, 3px padding, radius 10; active segment = white bg + ink text + thumb shadow; inactive = sub text.
- All add/edit sheets are key-remounted on every open (stale-form fix) — never reuse state across opens.

### Entries tab
- Right-aligned primary button `"New entry"` (orange; disabled offline). Rendered only when the list is non-empty (the empty state carries its own action instead).
- Empty state: headline `"No journal entries yet"`, subtext `"Write about your day, add a few photos."`, action `"New entry"` only while online.
- Sort: `createdAt` DESC (server-side; do not re-sort).
- Entry card (whole card tappable → opens reader): title (15.5px bold, ink); if `entryDate` set, raw `YYYY-MM-DD` (12px, tabular-nums, faint); if `body` non-blank, 2-line snippet via `entrySnippet(body)` — strips inline code/images/links/heading markers/`*_`, collapses whitespace, truncates at **140 chars + `…`**; up to **4** photo thumbs (56×56, radius 10, `thumb` size). Cards animate fade-up staggered `min(i,6)*40ms` (optional in RN).

### Entry reader (full-view replacement, not a modal)
- Header row: `"Back"` (hairline-bordered ghost button, ink) left; `"Edit"` (plain accent text button, disabled offline) right. Edit closes the reader and opens the entry sheet (web: reader unmounts first).
- Title (19px/24 700). Date line if set: `` `${entryDate} · ${weekday}` `` e.g. `2026-06-09 · Tuesday` (long English weekday; omit ` · …` if unparseable). Caption size, tabular-nums, faint.
- Body rendered as **sanitized GFM markdown** (only when non-blank): rehype-sanitize default schema (raw HTML dropped), all links forced external (`target=_blank`/RN `Linking.openURL`), link style = accent + underline; headings/lists/blockquote/code/hr styled per `Markdown.tsx`.
- Photo gallery, **read-only** (delete hidden/disabled): 80×80 thumb grid; tap thumb → full-screen viewer (black 0.85 scrim) showing `full` size, `‹` / `›` wrap-around buttons when >1 photo, `Close` button, tap-outside closes.
- Bottom: **two-tap delete**. First tap: text-only danger button `"Delete entry"` → arms to `"Tap again to delete"` (danger bg, white text). Failure shows banner `"Something went wrong. Try again."` and re-disarms. Disabled offline/pending. Success → close reader + reload.
- The reader always re-binds to the freshest loaded copy of its entry id after reloads (photos added in the edit sheet appear when returning).

### Entry sheet (add/edit; bottom sheet, scrim + grab handle)
- Heading `"New entry"` / `"Edit entry"`.
- Fields (labels are micro-uppercase faint): `"Title"` (text, required → inline error `"Add a title for this entry."`); `"Date"` (date input, value `YYYY-MM-DD`; defaults to **today** when adding AND when the edited entry has a null date; cleared field saves `entryDate: null`); `"Entry"` (8-row multiline).
- Markdown toolbar (label `"Formatting"`) above body: chips `Bold` `Italic` `Heading` `List` `Link` — wrap current selection / insert at caret with `**…**`, `*…*`, `# `, `- `, `[…](https://)`, then restore selection.
- Photos — **edit mode only**: gallery (80×80 thumbs, viewer, per-photo `✕` delete — single tap, no confirm) + `"Add a photo"` picker (single image). Statuses: `"Uploading…"`; offline `"Reconnect to add photos."`. Errors: `"That file isn't an image."` / `"That image is too large (max 10 MB)."` / `"You've reached the photo limit for this entry."` (12/owner) / `"Couldn't upload that photo. Try again."`. Add mode instead shows hint `"Save the entry first, then add photos."` Photo mutations refresh the parent immediately (sheet stays open).
- Buttons: `"Save"` (orange, flex-1; failure → `"Couldn't save. Try again."`) and `"Cancel"` (bordered, fixed ~90px). Edit mode adds two-tap delete: `"Delete entry"` (danger text) → `"Tap again to delete"` (danger bg).

### Reading list tab
- Right-aligned `"Add link"` (orange, disabled offline) — always rendered on this tab, even alongside the empty state.
- Empty state: `"No saved links yet"` / `"Save blogs and articles to read before your trip."` (no action button).
- Sort: `createdAt` DESC; trip-level links only (`placeId === null` — server filters).
- Link row (hairline card): left tappable area opens `link.url` externally. 48×48 thumb: if `thumbnail` set → `GET /api/links/thumb/{linkId}`; else mascot logo (~36px wide) centered on a **cream** 48px box. Text column: heading = `title?.trim() || linkDomain(url)` (13.5px semibold, 1-line truncate); domain = lowercased hostname minus `www.` (11.5px faint); note if set (11.5px faint, truncate). Right column stacked: `"Edit"` (accent) / `"Delete"` (danger) — link delete is **single-tap immediate** (no confirm), then reload.
- Link sheet (add/edit): heading `"Add link"`/`"Edit link"`. Fields `"URL"`, `"Title"`, `"Note"`. URL validated `http:`/`https:` only → error `"Enter a valid http(s) link."` **OG preview on URL blur — add mode + online + valid URL only**: `POST /api/links/preview {url, tripId}`; while pending `"Fetching preview…"`; prefills title **only if title is still empty**; stores returned `thumbnailPath` into the save payload `thumbnail`; if response has neither field, or throws → `"Couldn't fetch a preview — add the details yourself."` Edit mode preserves the existing thumbnail untouched. Save trims title/note to `null` when empty. Buttons Save/Cancel; edit mode `"Delete"` (single-tap, danger text). Errors: save `"Couldn't save. Try again."`, delete `"Something went wrong. Try again."`

### Photography tab (photo lists of reference shots)
- Right-aligned `"New list"` (orange, disabled offline).
- Empty state: `"No photo lists yet"` / `"Make a list and collect shots you want to take when you get there."` + action `"New list"` (online only).
- Sort: `orderIndex` ASC.
- List card (hairline border, radius 14, padding 16): name (15px semibold, truncate); count caption tabular (`"No photos"` / `"1 photo"` / `"{n} photos"`); two 32×32 icon buttons (surface bg, chip-round): Pencil = rename, Trash2 = delete list. List delete is **two-tap**: armed state turns the trash button danger-bg/white and shows caption `"Tap again to delete this list and its photos"`; failure → `"Something went wrong. Try again."` + disarm.
- Per-card gallery: same 80×80 grid + full-screen viewer; per-photo `✕` delete enabled while online (failure → `"Couldn't upload that photo. Try again."`). When 0 photos: `"No photos yet — add reference shots below."`
- `"Add photos"` — bordered accent button, **multi-select** image picker; uploads sequentially, **stops at the first failure** (same error strings as entries; `too_many` = 12/list); `"Uploading…"` while busy; offline caption `"Reconnect to add photos."`
- Photo-list sheet: heading `"New list"`/`"Rename list"`; field label `"List name"`, placeholder `"List name (e.g. Sunset spots)"`, autofocus, Enter submits; required error `"Name this list."`; primary button `"Create"` (create) / `"Save"` (rename) + `"Cancel"`.

## Already in RN seed (works as-is)

- Entries/Reading-list segmented tabs, load/error/empty scaffolding, online gating, key-remounted sheets.
- Entry feed card: title, raw date, 140-char snippet (`expo-rn/lib/journalView.ts:entrySnippet`), 4 thumbs.
- Reader: back/edit header, title, date label `YYYY-MM-DD · Weekday` (`entryDateLabel` — already matches web), photos (full-width `card` images).
- Entry sheet: title/date/body fields, today default for add, `entryDate: null` on empty, two-tap delete, save/cancel.
- Entry photos in edit mode: expo-image-picker add, `✕` remove, error mapping for `too_large`/`too_many`/`invalid_image`.
- Link rows (open URL, thumb fallback to app icon, heading/domain/note, edit/delete), link sheet with blur-triggered OG preview, prefill rules, trim-to-null, validation.
- API client: `api.journal.get/addEntry/updateEntry/deleteEntry/addLink/updateLink/deleteLink/linkPreview`, `api.photos.upload/remove`, `photoUrl.personal/linkThumb`, `x-api-key` write header.

## Gaps to build (numbered)

1. **Photography tab (entire feature).** Third segment `"Photography"`; list cards with rename/delete (two-tap)/count; per-list gallery + multi-photo upload (sequential, stop on first failure) + per-photo delete; photo-list sheet (create/rename). Data: `photoLists` from journal GET; photos owner_type `photo_list`. Edge cases: 12-photo cap per list (`too_many` 409), delete cascades list photos, empty-list copy, offline disables everything.
2. **Backend prerequisite — photo-list REST writes do not exist.** `app/_actions/photoLists.ts` (`addPhotoListAction(tripId,name)`, `renamePhotoListAction(tripId,id,name)`, `deletePhotoListAction(tripId,id)`) have no REST mirror. Add routes wrapping them via `restWrite` (pattern: `app/api/trips/[tripId]/journal/[entryId]/route.ts`): `POST /api/trips/{tripId}/photo-lists`, `PATCH + DELETE /api/trips/{tripId}/photo-lists/{listId}`.
3. **`photoLists` missing from RN types/response.** Extend `JournalResponse` in `expo-rn/lib/api/types.ts` with `photoLists: PhotoList[]` (`{id, tripId, name, orderIndex, photos: JournalPhoto[]}`); add `api.journal` photo-list write methods; widen `api.photos.upload` ownerType union with `'photo_list'`.
4. **Markdown rendering in the reader.** Web renders sanitized GFM; RN shows raw text. Use an RN markdown renderer (e.g. `react-native-markdown-display`): GFM, no raw HTML, links open via `Linking.openURL`, accent-colored underlined links, styles per `Markdown.tsx` (h1 19 bold, h2 16 bold, body 13.5/21, blockquote left hairline + sub, inline code surface bg). Edge: empty body → render nothing.
5. **Markdown toolbar in entry sheet.** `Formatting` chips Bold/Italic/Heading/List/Link wrapping the TextInput selection (track `onSelectionChange`); insert at caret when no selection; restore selection after.
6. **Two-tap delete inside the reader.** RN only deletes from the edit sheet; web also has reader-bottom `Delete entry` → `Tap again to delete` with error banner + disarm-on-failure. Wire to `DELETE journal/{entryId}`, close reader + reload on success.
7. **Full-screen photo viewer.** Replace reader's static image column with web behavior: 80×80 thumb grid everywhere (reader read-only, sheets deletable), tap → modal viewer (`full` size, aspect-fit, black scrim, `‹`/`›` wrap when >1, Close). Reuse for entries + photo lists.
8. **Exact string parity.** Adopt web copy verbatim (en.json table above). RN deviations to fix: tab label `Reading List` → `Reading list`; `New Entry`→`New entry`; `Add Link`→`Add link`; empty states (`No entries yet`→`No journal entries yet`, links empty headline/subtext); error strings (`Title is required.`→`Add a title for this entry.`; save/delete/preview/upload messages); loading/error screens.
9. **Edit-mode date default.** Web defaults the date field to **today** when the edited entry has `entryDate: null` (`entry?.entryDate ?? today`); RN uses `''`. Match web. Keep plain `YYYY-MM-DD` text field (server zod-validates; surface save error on bad format).
10. **Entries-tab button placement.** Web hides the top `New entry` button when the list is empty (empty state owns the action); links tab always shows `Add link`. RN header shows the button unconditionally — match web per-tab rules.
11. **Photo error-string mapping.** Map upload error codes exactly: `too_large` → `That image is too large (max 10 MB).`; `too_many` → `You've reached the photo limit for this entry.`; `not_image`/`invalid_image` → `That file isn't an image.`; else `Couldn't upload that photo. Try again.`
12. **Atlas Light restyle** (see next section) — seed is warm-editorial (coral, `colors.card`/`paper`, card shadows).

## Atlas Light styling notes for this section

Replace `expo-rn/lib/theme.ts` warm-editorial values with the Atlas Light tokens (`tailwind.config.ts` is canonical):
- `bg #FFFFFF` (all screens + cards + sheets — no separate "card" color), `surface #F4F5F2` (segmented track, toolbar chips, icon-button bg, disabled-button bg), `ink #1B1F1C`, `sub #6E746E`, `faint #A8ADA7`, `line #E9EBE6` (ALL borders, 1px hairlines), `accent #33677A` (+ `accentTint #E6EFF1`), `orange #E0502C` (press `#C84624`), `cream #F7F1E4` (link-thumb fallback box only), `danger #B3402C`, scrim `rgba(27,31,28,0.42)`.
- **No card shadows.** Entry/link/list cards = white bg + 1px `line` border, radius 14. Delete RN seed's `shadowColor/elevation` on `entryCard`. Only two shadows allowed: segmented active thumb (`0 1px 2px rgba(27,31,28,0.10)`) and bottom sheet (`0 -12px 40px rgba(27,31,28,0.25)`).
- Radii: card 14, control/input 10, sheet top 22, chip 999. Buttons: primary orange radius 10–12, white 700 text; secondary = white bg + line border + ink text.
- Color discipline: **orange = create/save only** (`New entry`, `Add link`, `New list`, `Save`); **accent teal = navigation/info** (`Edit` text buttons, markdown links, `Add photos` outline button); danger = plain text until armed, then danger bg + white text. RN seed's coral header buttons, coral `Back`/`Edit` pill → restyle (Back = bordered ghost ink; Edit = plain accent text).
- Type scale: title 19/24 w700 ls-0.02em; heading 15/20 w600; body 13.5/21; label 13/18 w600; caption 12/16 w500; micro 10.5/14 w700 uppercase letterSpacing~1 (field labels). Dates/counts use `fontVariant: ['tabular-nums']`. Font: Instrument Sans (no serif/Fraunces anywhere).
- Inputs: white bg, 1px line border, radius 10, 14px ink text; focus = accent border (skip the web's 3px tint ring if impractical).
- Icons: lucide (`lucide-react-native`) Pencil/Trash2 @16/1.75 in 32×32 surface chips for photo-list actions.

## API surface

Base `https://eric.month2month.com/burgergo`. Writes: JSON + optional `x-api-key` (`restWrite`: 401 `unauthorized`, 404 `not_found`, 400 `invalid_input`; success defaults to `{ok:true}`).

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/trips/{tripId}/journal` | → `{ entries: EntryDTO[], links: SavedLink[], photoLists: PhotoListDTO[] }` |
| POST | `/api/trips/{tripId}/journal` | `{ title, body?, entryDate? }` → `{ entry }` |
| PATCH | `/api/trips/{tripId}/journal/{entryId}` | `{ title?, body?, entryDate? }` (`entryDate: null` clears) → `{ entry }` |
| DELETE | `/api/trips/{tripId}/journal/{entryId}` | → `{ ok: true }` |
| POST | `/api/trips/{tripId}/links` | `{ url, title?, note?, thumbnail? }` → `{ link }` |
| PATCH | `/api/trips/{tripId}/links/{linkId}` | partial of same → `{ link }` |
| DELETE | `/api/trips/{tripId}/links/{linkId}` | → `{ ok: true }` |
| POST | `/api/links/preview` | `{ url, tripId }` → `{ title?, thumbnailPath? }` (best-effort; `{}` on nothing) |
| GET | `/api/links/thumb/{linkId}` | → image (link OG thumb) |
| POST | `/api/photos` | multipart `image` + `tripId` + `ownerType` (`journal` \| `photo_list`) + `ownerId` (entryId/listId) → 201 `{ photo }`. Errors: 400 `bad_request`/`missing_image`/`bad_owner_type`, 413 `too_large` (>10 MB), 415 `not_image`/`invalid_image`, 404 `not_found`, 409 `too_many` (>12/owner) |
| DELETE | `/api/photos/p/{photoId}` | → `{ ok: true }` |
| GET | `/api/photos/p/{photoId}/{thumb\|card\|full}` | → image (grid=thumb, inline=card, viewer=full) |
| POST | `/api/trips/{tripId}/photo-lists` | **NEW** `{ name }` → `{ list }` (wraps `addPhotoListAction`) |
| PATCH | `/api/trips/{tripId}/photo-lists/{listId}` | **NEW** `{ name }` → `{ ok: true }` (wraps `renamePhotoListAction`) |
| DELETE | `/api/trips/{tripId}/photo-lists/{listId}` | **NEW** → `{ ok: true }` (wraps `deletePhotoListAction`; cascades photos) |

Formatting rules: `entryDate` is a plain `YYYY-MM-DD` string (display raw; reader appends ` · {long weekday}`); new-entry default = device-local today. Snippets = 140 chars + `…`. Sort orders (all server-side): entries `createdAt` DESC, links `createdAt` DESC, photo lists `orderIndex` ASC, photos `orderIndex` ASC. Photo caps: 12/owner, 10 MB, `image/*` only. No money or distance values appear in this section (money elsewhere = integer minor units; distances = miles). DB timestamps are seconds — never displayed here.