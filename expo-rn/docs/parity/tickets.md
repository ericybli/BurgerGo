# tickets parity spec

Section: **Tickets** — reservations with optional date/time/location, a note, and multi-file attachments (booking PDFs, QR-code images). Web source of truth: `components/tickets/TicketsClient.tsx`, `components/tickets/TicketSheet.tsx`, `app/_actions/tickets.ts`, `app/api/trips/[tripId]/tickets/route.ts`, `app/api/tickets/files/route.ts`, `app/api/tickets/files/[fileId]/route.ts`, repo `src/db/repos/tickets.ts`. Labels below are the exact strings from `messages/en.json` → `tickets.*` (RN is English-only; hardcode them).

## Web feature inventory (exhaustive)

### Header row
- Title **"Tickets"** (left, bold ~21px ink) + button **"Add ticket"** (right, orange filled, white text).
- "Add ticket" is **disabled when offline** (web tracks `navigator.onLine`; RN equivalent: `useOnline()` from `expo-rn/lib/online.ts`).
- Tapping it opens the sheet in **create mode** (no ticket passed).
- Nav placement: Tickets is a **bottom tab between Eats and Budget** (web `components/BottomTabBar.tsx`: `plan, eats, tickets, budget, packing, journal`; lucide `Ticket` icon).

### Load states
- Loading: centered sub-colored text **"Loading your tickets…"**.
- Error (fetch failed): EmptyState with headline **"Couldn't load tickets"**, subtext **"Check your connection and try again."**.
- Empty (loaded, 0 tickets): EmptyState headline **"No tickets yet"**, subtext **"Keep reservations, booking PDFs, and QR codes in one place."**, plus an **"Add ticket"** action button shown **only when online**.

### Ticket card (vertical list, 12px gap, staggered fade-up entrance ≤6 items × 40ms)
Card = hairline-bordered rounded box (radius 14, border `line`, bg white, padding 12×14). Content top-to-bottom, each block conditional:
1. **Title** — always; bold ~15.5px ink.
2. **Date · time line** — only if `date` OR `time` set; renders `[date, time].filter(Boolean).join(' · ')` (raw `YYYY-MM-DD` and `HH:MM`, no locale formatting), caption size, `faint` color, tabular numerals.
3. **Location** — only if set; caption, `sub` color.
4. **Note** — only if set; ~13px/19px `sub`, **whitespace preserved** (multi-line).
5. **Attachment list** — only if `files.length > 0`; one row per file (6px gap):
   - Row = hairline border (radius 10, px 12 / py 8), tappable; opens the file **inline in the browser** (web: `<a target="_blank">` to `/api/tickets/files/{fileId}`).
   - Leading icon 15px, **accent** colored: lucide `FileText` when `mime === 'application/pdf'`, else `Image`.
   - File **name** (from DB, original upload name), caption semibold ink, single line truncated.
   - Files are in **upload order** (server: createdAt asc, id asc).
6. **Action row** — **"Edit"** (accent text button) and **"Delete"** (danger text button), both disabled offline.
   - Edit opens the sheet pre-filled (edit mode).
   - Delete is **two-tap confirm**: first tap swaps label to **"Tap again to delete"** and restyles as a danger-filled pill (white text, rounded, px 10 / py 4); second tap deletes then reloads the list. Tapping a *different* ticket's delete moves the confirm state there (only one pending confirm at a time; no timeout/outside-tap reset).
   - Delete failure is swallowed; list reloads either way ("the reload shows the truth").

### Sort order (server-side, replicate exactly if sorting client-side)
`(date, time)` ascending with **NULLs last**, tiebreak `createdAt` asc. Implementation: key = `` `${date ?? '9999-99-99'}T${time ?? '99:99'}` ``, string compare.

### Ticket sheet (bottom sheet, create + edit)
- Heading: **"New ticket"** (create) / **"Edit ticket"** (edit). Drag-handle bar, scrollable, max-height ~85% screen, scrim backdrop, tap-outside/Escape closes. Web **key-remounts** the sheet per open (`ticket:{id|new|closed}`) so the form always resets — RN must reset state on open the same way.
- Error banner (top, when set): danger text on 10%-danger background, e.g. validation or save failure.
- Fields (labels are MICRO uppercase faint; inputs hairline-bordered, accent focus ring):
  - **"Title"** — text, required.
  - **"Date"** — `YYYY-MM-DD` (web `<input type=date>`; RN: text Field with placeholder `YYYY-MM-DD`, tabular-nums — matches BudgetScreen convention).
  - **"Time"** — `HH:MM` (web `<input type=time>`; RN: text Field placeholder `HH:MM`).
  - **"Location"** — text.
  - **"Note"** — multiline textarea (3 rows).
- **"Attachments"** block:
  - Existing files (edit mode only): same icon+name rows as the card, plus a trailing **×** remove button (aria "Remove file"). Tapping × deletes that file **immediately** (server call), removes it from the local list, and triggers the parent list refresh — the sheet stays open. Failure → error banner **"Couldn't save. Try again."**.
  - Pending files (picked, not yet uploaded): same rows but **dashed** border, faint icon, `sub` name; × removes from the pending array (no server call).
  - **"Add files"** picker button (accent text, hairline border): multiple selection, images + PDFs only. Files with any other mime are silently dropped and the error **"Only images and PDFs are supported."** is shown; valid ones still append. Picker is disabled offline.
  - Hint line under the button: **"Images or PDFs — booking confirmations, QR codes."** (caption, faint).
- Footer: **"Save"** (orange filled, flex-1; shows **"Saving…"** while busy; disabled when offline or saving) + **"Cancel"** (fixed ~90px, hairline border, never disabled).
- Save flow (single submit covers row + uploads):
  1. Client validation: trimmed title required → error **"Add a title for this ticket."**, abort.
  2. Payload: `{ title: trimmed, date: date || null, time: time || null, location: location.trim() || null, note: note.trim() || null }` — **empty strings become null**.
  3. Create (`POST`) or update (`PATCH`) the ticket row; get back `saved.id`.
  4. Upload pending files **sequentially** (multipart, one per request); stop at the first failure.
  5. Success: `onSaved()` (parent reloads list) then close. Any failure: error **"Couldn't save. Try again."**, sheet stays open, but **still call `onSaved()`** (partial uploads may have landed).
- Server validation (mirror client-side where cheap): title trim 1–200; date `^\d{4}-\d{2}-\d{2}$`; time `^\d{2}:\d{2}$`; location trim ≤300; note ≤2000.

### Upload constraints (server-enforced; surface friendly errors)
- Allowed mimes: `application/pdf` or anything `image/*`. → 415 `unsupported_type`.
- Max **15 MB** per file → 413 `too_large`.
- Max **12 files per ticket** → 409 `too_many`.
- Original bytes are stored unmodified (PDFs open, QR codes stay scannable); display filename kept in DB (non-ASCII safe).

### Data shapes
```ts
type Ticket = { id: string; tripId: string; title: string; date: string | null; time: string | null;
  location: string | null; note: string | null; createdAt: string; updatedAt: string };
type TicketFile = { id: string; ticketId: string; tripId: string; name: string; path: string;
  mime: string; size: number; createdAt: string };
type TicketDTO = Ticket & { files: TicketFile[] };   // GET returns { tickets: TicketDTO[] }, pre-sorted
```

## Already in RN seed (works as-is)
Nothing tickets-specific exists — **full build**. Reusable infrastructure already present in `expo-rn/`:
- `lib/api/client.ts`: `getJson` / `writeJson` (sends `x-api-key` when `WRITE_KEY` set) / `postForm` multipart helper / `API_BASE` (`https://eric.month2month.com/burgergo`).
- `lib/online.ts` `useOnline()` — gate all mutating affordances.
- `components/ui/index.tsx`: `Screen`, `Button`, `Field`, `Sheet`, `Loading`, `EmptyState`, `ErrorState`, `OfflineHint` (note: some still use legacy warm-editorial styles — see styling notes).
- `lib/theme.ts`: Atlas Light tokens already mirrored (`colors.bg/surface/ink/sub/faint/line/accent/orange/danger`, `type`, `radius`).
- Deps already installed: `expo-document-picker` (~14.x, handles PDFs **and** images), `expo-image-picker`, `@react-navigation/bottom-tabs`.
- Patterns to copy: two-tap delete + sheet forms in `screens/budget/BudgetScreen.tsx` / `screens/todo/TasksView.tsx`; date-as-text Field with `YYYY-MM-DD` placeholder (BudgetScreen line ~505).

## Gaps to build (numbered)

1. **Backend: REST write routes for tickets (web repo, prerequisite).** The REST write surface skipped tickets — `app/api/trips/[tripId]/tickets/route.ts` is **GET-only** and `app/api/tickets/files/[fileId]/route.ts` is GET-only. Add, following the exact `restWrite` pattern in `app/api/trips/[tripId]/tasks/[taskId]/route.ts`:
   - `POST /api/trips/{tripId}/tickets` → `addTicketAction({ tripId, ...body })`, return `{ ticket }`.
   - New file `app/api/trips/[tripId]/tickets/[ticketId]/route.ts`: `PATCH` → `updateTicketAction(ticketId, body)` returning `{ ticket }`; `DELETE` → `deleteTicketAction(ticketId)` returning `{ ok: true }`.
   - Add `DELETE` to `app/api/tickets/files/[fileId]/route.ts` → `restWrite` wrapping `deleteTicketFileAction(fileId)`.
   - Edge cases handled by `restWrite`: 401 when key mismatch, 404 on "not found", 400 on zod errors. `export const dynamic = 'force-dynamic'`. Gate: `tsc` + deploy before RN work can be verified.

2. **RN API namespace** — add `tickets` to `lib/api/index.ts` + types to `lib/api/types.ts`:
   - `list(tripId)` → GET `/api/trips/{tripId}/tickets` → `{ tickets: TicketDTO[] }` (server pre-sorted; don't re-sort).
   - `create(tripId, body)` / `update(tripId, ticketId, patch)` / `remove(tripId, ticketId)` / `removeFile(fileId)` via `writeJson`.
   - `uploadFile(tripId, ticketId, file: {uri,name,type})` — **cannot reuse `postForm` as-is**: it hardcodes the form field name `image`; tickets upload requires field **`file`** plus fields `tripId`, `ticketId`. Add a field-name parameter or a sibling helper. Keep `x-api-key` header behavior.
   - URL builder `ticketFileUrl(fileId) = \`${API_BASE}/api/tickets/files/${fileId}\`` (mirror of web `ticketFileUrl`).

3. **Tickets tab registration** — add `Tickets: undefined` to `TripTabParamList` (`navigation/types.ts`) and a `Tab.Screen name="Tickets"` in `navigation/TripTabs.tsx` **between Eats and Budget** (web order), label "Tickets".

4. **`screens/tickets/TicketsScreen.tsx`** — list screen per the inventory above: header row ("Tickets" + "Add ticket" orange button, offline-disabled), Loading/Error/Empty states with the exact strings, FlatList of cards (sorted as delivered), two-tap delete ("Delete" → danger pill "Tap again to delete"), Edit opens sheet, reload after every mutation (and after delete failure too). Refetch on focus or pull-to-refresh is acceptable; web reloads via explicit `load()` after `onSaved`.

5. **`screens/tickets/TicketSheet.tsx`** — create/edit sheet per the inventory: 5 fields with exact labels, error banner, existing-files list with immediate-delete ×, pending-files list (dashed) with local-remove ×, "Add files" picker, hint text, Save/Cancel footer, the exact save sequence (row first, then sequential uploads, partial-failure semantics, `onSaved` on both paths). Reset all state when opened (remount via `key` or effect on `visible`). Edge cases: title-only validation client-side; treat `''` → `null`; date/time free-text — optionally pre-validate with the same regexes to avoid a server 400 surfacing as the generic "Couldn't save. Try again.".

6. **File picking** — `DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true })`. Map results to `{ uri, name, type }` (fall back `name → 'attachment'`, infer mime from extension if `mimeType` missing). Filter non-image/PDF picks and show "Only images and PDFs are supported." while keeping valid ones. Optional pre-flight: reject files > 15 MB (`size` from picker) client-side with the same error treatment; otherwise surface server 413/409 as the save-failed banner.

7. **Opening attachments** — file name rows call `Linking.openURL(ticketFileUrl(f.id))` (or `expo-web-browser` `openBrowserAsync` for in-app feel — pick one and use it for both PDFs and images; the endpoint serves `Content-Disposition: inline` with the original filename, `Cache-Control: private, max-age=86400`).

8. **Offline gating** — `useOnline()`: disable Add ticket, Edit, Delete, Add files, existing-file ×, and Save (Cancel stays enabled), matching web's `disabled={!online}` plumbing into the sheet.

## Atlas Light styling notes for this section

RN `lib/theme.ts` already carries the canonical tokens — **use canonical names only** (`colors.bg/surface/ink/sub/faint/line/accent/accentTint/orange/orangePress/danger`), never the legacy `coral/paper/card` aliases. Do **not** reuse the seed's `Card` primitive (it has a drop shadow — Atlas forbids card shadows); build flat hairline cards.

| Web class (tickets) | RN token intent |
|---|---|
| `bg-bg`, card/sheet/input background | `colors.bg` (#FFFFFF) |
| `border-line` everywhere (cards, file rows, inputs, Cancel) | 1px `colors.line` hairline; **no shadows** on cards/rows |
| `text-ink` titles / file names | `colors.ink` + `type.title`/`type.heading` (Instrument Sans named weights, never `fontWeight`) |
| `text-sub` location/note | `colors.sub`, `type.caption`/`type.body` |
| `text-faint` date·time, labels, hint, disabled text | `colors.faint`; field labels = `type.micro` UPPERCASE |
| `bg-orange` + `hover:bg-orange-press` (Add ticket, Save) | `colors.orange`, pressed `colors.orangePress`, white text — **orange = create/save only** |
| `text-accent` (Edit link, file icons, Add files) | `colors.accent` (teal) — info/navigation, never for save |
| focus ring `shadow-[0_0_0_3px_var(--accent-tint)]` | focused input: `borderColor: accent` (+ optional `accentTint` glow) |
| delete confirm `bg-danger` pill / `text-danger` | `colors.danger`; confirm pill radius `radius.chip` |
| card `rounded-[14px]` / file row `rounded-[10px]` / inputs `rounded-control` / sheet `rounded-t-sheet` | `radius.card` 14 / 10 / `radius.control` 10 / sheet top `radius.sheet` 22 |
| sheet: scrim + `shadow-sheet` + handle bar (`bg-line` pill 40×4) | scrim `colors.scrim`; sheet **may** keep a soft shadow (sheets are the exception); handle = `line` pill |
| pending file rows `border-dashed` | `borderStyle: 'dashed'`, icon `faint`, name `sub` |
| disabled buttons `disabled:bg-surface disabled:text-faint` | bg `colors.surface`, text `colors.faint` |
| lucide `FileText` / `Image` / `X` icons | `lucide-react-native` (add dep) at size 15 / strokeWidth 1.75 (× at 13 / 2.2); fallback: minimal SVG via existing `react-native-svg` |

Formatting rules (app-wide, as they apply here): dates render **raw `YYYY-MM-DD`**, times **raw `HH:MM`**, joined with `" · "`, tabular numerals; tickets has **no money or distance fields** (elsewhere: money = integer minor units, distances = miles); attachment order = upload order; list order = (date,time) asc, undated last.

## API surface (everything this section calls)

Base: `https://eric.month2month.com/burgergo`. Writes send `x-api-key: <WRITE_KEY>` when configured (open otherwise); JSON writes use `content-type: application/json`. Error envelope: `{ error, message? }` — 401 `unauthorized`, 404 `not_found`, 400 `invalid_input`/`bad_request`, 415 `unsupported_type`, 413 `too_large`, 409 `too_many`.

| # | Method | Path | Body / notes |
|---|---|---|---|
| 1 | GET | `/api/trips/{tripId}/tickets` | → `{ tickets: TicketDTO[] }`, sorted (date,time) asc nulls-last; files embedded in upload order. **Exists.** |
| 2 | POST | `/api/trips/{tripId}/tickets` | `{ title, date?: string\|null, time?: string\|null, location?: string\|null, note?: string\|null }` → `{ ticket }`. **Build (gap 1).** |
| 3 | PATCH | `/api/trips/{tripId}/tickets/{ticketId}` | same fields, all optional → `{ ticket }`. **Build (gap 1).** |
| 4 | DELETE | `/api/trips/{tripId}/tickets/{ticketId}` | no body → `{ ok: true }`; server deletes attachment bytes + per-ticket dir. **Build (gap 1).** |
| 5 | POST | `/api/tickets/files` | multipart form: `file` (binary part — field name is `file`, not `image`), `tripId`, `ticketId` → 201 `{ file: TicketFile }`. Caps: 15 MB, 12/ticket, pdf+image only. **Exists** (note: currently no auth wrapper). |
| 6 | GET | `/api/tickets/files/{fileId}` | streams bytes inline, original filename (RFC 5987), `Cache-Control: private, max-age=86400`. Used as the tap-to-open URL. **Exists.** |
| 7 | DELETE | `/api/tickets/files/{fileId}` | no body → `{ ok: true }` (row + bytes). **Build (gap 1).** |

Call mapping: screen load → 1; sheet Save → 2 or 3, then 5 sequentially per pending file; existing-file × → 7; card delete (second tap) → 4; after every mutation → 1 again.