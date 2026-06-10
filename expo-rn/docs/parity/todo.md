# todo parity spec

Web source of truth: `app/trip/[tripId]/packing/page.tsx` → `components/todo/ToDoClient.tsx` (segmented wrapper), `components/todo/TaskList.tsx` + `components/todo/TaskRow.tsx` (Tasks), `components/packing/PackingClient.tsx` + `PackingCategorySection.tsx` + `PackingItemRow.tsx` (Packing). RN seed: `expo-rn/screens/todo/{TodoScreen,PackingView,TasksView}.tsx`. Labels from `messages/en.json` namespaces `todo`, `tasks`, `packing`.

## Web feature inventory (exhaustive)

### Segmented control (ToDoClient)
- Two segments, default tab = **Packing**: labels **"Packing list"** / **"Tasks"**. Track = `surface` bg, radius 10, 3px padding; active thumb = `bg` (white) + `ink` text + thumb shadow; inactive = `sub` text. Tab state is local (not persisted).
- Each sub-view owns its own fetch + mutations; switching tabs remounts the other view (fresh load).

### Packing tab (PackingClient)
- **Load**: GET `/api/trips/{tripId}/packing` on mount. Loading state = centered `sub` text **"Loading your packing list…"**. Error state = EmptyState (mascot `burgergo-logo.png` 112px @ 90% opacity, headline **"Couldn't load your packing list"**, subtext **"Connect to the internet and try again."**) — error replaces the WHOLE tab including the add row.
- **Add-category row** (top, below segmented control): text input placeholder **"New category (e.g. Clothes)"** + secondary button **"Add category"** (hairline border, `bg` fill, `sub` text — NOT orange). Button disabled when offline, busy, or trimmed input empty. Enter key submits. On success: input clears, list reloads. On failure: input KEEPS its text (cleared only after success).
- **Empty state** (loaded, zero categories): mascot + **"Nothing to pack yet"** / **"Create a category, then add things to bring."**
- **Category card** (one per category, 12px gap): hairline-border card, `bg` fill. Header row: category name in **micro uppercase `faint`** (truncated, flex-1) · progress counter **`{packed}/{total}`** (12px semibold `sub`, tabular-nums) · delete button = lucide **Trash2** icon 14px `faint` (aria "Delete {name} and its items"; press → `danger` tint). Deleting a category deletes its items (FK cascade), no confirm dialog.
- **No category rename UI** on web (PATCH endpoint exists but is not exposed — do not build it).
- **Item rows** inside card, separated by hairline dividers (`divide-y divide-line`); hidden entirely when category has no items (no inner empty state). Each row:
  - Packed checkbox 21×21, radius 7, 1.5px `faint` border; checked → `accent` fill + white lucide Check (3px stroke). Toggles immediately on tap.
  - Name: inline-editable text input, 14px; transparent until focus (focus → `line` border + `bg` + accent focus ring). Packed → `faint` + strikethrough. Saves on blur/Enter; empty or unchanged edit reverts to server value.
  - Quantity: inline-editable numeric input ~38px wide, 12.5px semibold, tabular-nums, `surface` bg until focus. On blur/Enter coerced `max(1, floor(Number(v) || 1))`, then PATCHed only if changed.
  - Delete: **"✕"** text button, `faint` (aria "Delete item"; active → `danger`).
- **Add-item row** (bottom of each card): name input placeholder **"Add an item"** (12.5px) + quantity number input (default "1", min 1, 38px) + button **"Add"** = accent OUTLINE (border `accent`, text `accent`, hover `accent-tint`), disabled when offline/busy/name empty. After add: name resets to '', qty resets to "1". Enter on name input submits.
- **Per-row busy**: each row/card has its own `busy` flag — only the mutated row's controls freeze, not the whole list. Top-level `busy` only guards the add-category row.
- **Offline**: `navigator.onLine` listener; offline ⇒ `disabled` prop freezes every control (reads still render from cache on web).

### Tasks tab (TaskList)
- **Load**: GET `/api/trips/{tripId}/tasks`. Loading = **"Loading your tasks…"**; error = EmptyState **"Couldn't load tasks"** / **"Check your connection and try again."** (replaces whole tab).
- **Add-task row**: input placeholder **"Add a task"** + button **"Add"** = **orange** primary (white text, `orange-press` on press), disabled when offline/busy/trimmed-empty. Enter submits. Input clears only on success.
- **Empty state**: mascot + **"No tasks yet"** / **"Add things you need to get done for this trip."**
- **Task cards** (10px gap, `animate-fade-up` stagger: `delay = min(i,6) * 40ms`). Each card (hairline border, `bg`):
  - Top row: done checkbox (identical recipe to packing, accent fill + white Check; aria "Done: {title}") · inline-editable title (14px **semibold**; done → `faint` + strikethrough; commit on blur/Enter, empty/unchanged reverts) · **"✕"** delete (aria "Delete task").
  - Below: note textarea, full-width, `surface` bg (focus → `bg` + accent border), 12.5px, placeholder **"Add a note"**, `rows = note ? 2 : 1`, saves trimmed-or-null on blur only if changed.
- Sort: creation order (`orderIndex` asc) — render server order as-is; new tasks append at the end. No done/undone re-sorting, no filtering, no count badge.

### Validation (server, mirror client-side)
- Category/item name: trimmed, 1–100 chars. Quantity: int 1–9999 (client only clamps min 1 — a >9999 entry gets a 400; acceptable to also clamp client-side). Task title: trimmed, 1–300. Note: ≤2000, null clears.

## Already in RN seed (works as-is)

- `TodoScreen` segmented control with packing/tasks switch (labels need fixing).
- Full fetch/render/mutate loop for both tabs via namespaced client: `api.packing.{list,addCategory,renameCategory,deleteCategory,addItem,updateItem,deleteItem}` and `api.tasks.{list,create,update,remove}` (`expo-rn/lib/api/index.ts` lines 118–161) — endpoints, methods, bodies all correct, `x-api-key` handled in `client.ts`.
- Checkbox toggle (immediate), inline name/title/qty/note edit with commit-on-blur + revert-on-empty/unchanged + re-seed-from-props after reload, qty coercion `coerceQty`, delete item/category/task, packed `{n}/{total}` counter with tabular-nums, add flows with Enter submit, `useOnline()` gating, loading + empty + error states.
- `expo-rn/lib/theme.ts` and `components/ui` (Card, SegmentedControl, EmptyState, Loading) are ALREADY Atlas Light (hairline cards, no shadows, thumb shadow on segmented control) — the todo screens just use legacy color aliases (`coral`/`teal`/`paper`/`card`/`inkMuted`) which resolve to the correct Atlas hexes, and emoji glyphs instead of icons.

## Gaps to build

1. **Exact copy parity** — replace all divergent strings: segment label `"Packing"` → **"Packing list"**; category placeholder `"Category name…"` → **"New category (e.g. Clothes)"**; category button `"Add"` → **"Add category"**; item placeholder `"Item name…"` → **"Add an item"**; task placeholder `"New task…"` → **"Add a task"**; note placeholder `"Add a note…"` → **"Add a note"**; loading `"Loading…"` → **"Loading your packing list…"** / **"Loading your tasks…"**; packing empty subtext → **"Create a category, then add things to bring."**; tasks error headline → **"Couldn't load tasks"**, subtext → **"Check your connection and try again."**; tasks empty subtext → **"Add things you need to get done for this trip."** Source: `messages/en.json`. Edge: apostrophes are typographic (') in en.json.
2. **Add-input clear timing** — RN clears the input before the request; web clears only after success. Move `setNewCat('')`/`setNewTask('')`/item resets into the success path so failed adds keep the user's text. Endpoint: POST routes below.
3. **Disable Add buttons on empty input** — web disables the button when `trim() === ''` (visual disabled state), RN only early-returns. Apply to add-category, add-item, add-task.
4. **Per-row busy instead of global freeze** — RN's single `run()` busy flag disables every control during any mutation; web freezes only the mutated row (offline is the only global freeze). Give each TaskCard/ItemRow/CategoryCard its own busy state; top-level busy guards only its own add row. Edge: failed save → swallow error, reload re-syncs (keep RN's reload-on-failure).
5. **Error state replaces whole tab** — web returns the EmptyState INSTEAD of the add row + list; RN renders the add row above the error. Match web (early return).
6. **Empty-state mascot** — web EmptyState shows bundled `burgergo-logo.png` (112×112, 90% opacity) above headline. Add optional mascot image to RN `EmptyState` (bundle the asset in expo-rn) and use it on loading-error/empty for both tabs, alt/accessibilityLabel = "Packing list" / "Tasks".
7. **Button hierarchy parity** — Tasks "Add" = orange primary (already coral=orange, keep); **Add category** = secondary (hairline `line` border, `bg` fill, `sub` text — RN currently orange, wrong: it's not the section's primary creator); **Add** (item) = accent outline (border + text `accent`, currently `paper` bg + `ink` text). Disabled looks: tasks-Add → `surface` bg + `faint` text; secondary/outline → 40% opacity.
8. **Category header restyle** — web header is micro uppercase `faint` (10.5px, bold, letter-spacing) not 16px bold ink; counter 12px semibold `sub`. Replace 🗑 emoji with `Trash2` from `lucide-react-native` (14px, `faint`); replace ✓ glyph with lucide `Check` (white, strokeWidth 3) in checkboxes. Keep ✕ as text for item/task delete (web uses literal ✕).
9. **Item-row hairline dividers** — items inside a category card are separated by 1px `line` dividers (no divider above first item); RN has none. Also hide the items block entirely when empty (RN already does by mapping []).
10. **Task note field styling + sizing** — web note is a `surface`-bg rounded box (12.5px text) that grows (2 lines when non-empty, 1 when empty); RN note is borderless. Restyle: `surface` bg, radius ~10, padding 8/12, `ink` text, placeholder `faint`; multiline, minHeight equivalent to 1 row, larger when filled.
11. **Checkbox spec match** — 21×21 (RN has 24), radius 7, 1.5px border `faint` (RN uses `line`), checked = `accent` fill + `accent` border. Add accessibilityLabel: "Done: {title}" / "Packed: {name}"; delete buttons: "Delete task" / "Delete item" / "Delete {name} and its items".
12. **Task list fade-up stagger (optional polish)** — web animates rows in with 40ms stagger capped at index 6. RN: small translateY+opacity Animated/Reanimated entrance, same delays. Skip if it fights FlatList recycling; functionality parity does not require it.
13. **Client-side max clamps** — clamp qty to ≤9999 and enforce maxLength: name/category 100, title 300, note 2000 to avoid server 400s (server validation in `app/_actions/packing.ts` + `tasks.ts`).
14. **Do NOT add category rename UI** — endpoint + `api.packing.renameCategory` exist but web exposes no rename; parity = absent.

## Atlas Light styling notes for this section

- Tokens (theme.ts canonical names; stop using legacy aliases in these screens): `bg` #FFFFFF page + cards/inputs · `surface` #F4F5F2 segmented track, note field, qty pill, disabled-primary bg · `ink` #1B1F1C primary text · `sub` #6E746E counters, secondary button text, loading text · `faint` #A8ADA7 category headers, placeholders, checkbox borders, delete glyphs, done/packed strikethrough text · `line` #E9EBE6 ALL card/input borders + item dividers (1px hairlines) · `accent` #33677A checkbox fill + add-item outline + input focus border (`accentTint` #E6EFF1 focus ring) · `orange` #E0502C ONLY the tasks "Add" button (creates something); press #C84624 · `danger` #B3402C delete active tint.
- Web class → intent map: `rounded-card` → radius 14 card, `border-line bg-bg` → white card with hairline, **no shadows** anywhere except the SegmentedControl active thumb (RN ui already has it: shadowOpacity 0.1/radius 2/offset 0,1/elevation 1) and sheets; `rounded-control` → radius ~10 inputs/buttons; `rounded-chip`/`rounded-[7px]` → checkbox + tiny icon-button radii; `text-label` → 13px semibold (buttons/segments); `text-micro` → 10.5px bold uppercase letter-spaced (category headers); `text-body` → 13.5px regular; row text 14px, secondary inputs 12.5px; `[font-variant-numeric:tabular-nums]` → `fontVariant: ['tabular-nums']` on counters/qty.
- Fonts: Instrument Sans via `theme.font` — pair `fontFamily` names, never `fontWeight` (RN doesn't synthesize weights). Title/name inputs semibold; qty semibold.
- Card paddings: category card px 14 / pt 10 / pb 12; task card px 14 / py 11; item rows py 8 inside dividers; cards gap 12 (packing) / 10 (tasks).

## API surface

All paths relative to API base (prod `https://eric.month2month.com/burgergo`). Writes send `x-api-key` header when `BURGERGO_API_KEY` is set (already in `expo-rn/lib/api/client.ts`). Write errors: `401 {error:'unauthorized'}`, `404 {error:'not_found',message}` ("… not found"), `400 {error:'invalid_input',message}` (zod). DELETE sends no body; empty handler result → `{ok:true}`.

| # | Method | Path | Body | Returns |
|---|--------|------|------|---------|
| 1 | GET | `/api/trips/{tripId}/tasks` | — | `{ tasks: Task[] }` (orderIndex asc = creation order) |
| 2 | POST | `/api/trips/{tripId}/tasks` | `{ title }` | `{ task }` |
| 3 | PATCH | `/api/trips/{tripId}/tasks/{taskId}` | any of `{ title?, note?: string\|null, done?: boolean }` | `{ task }` |
| 4 | DELETE | `/api/trips/{tripId}/tasks/{taskId}` | — | `{ ok: true }` |
| 5 | GET | `/api/trips/{tripId}/packing` | — | `{ categories: PackingCategoryDTO[] }` (categories orderIndex asc, id tiebreak; nested `items[]` orderIndex asc) |
| 6 | POST | `/api/trips/{tripId}/packing/categories` | `{ name }` | `{ category }` |
| 7 | PATCH | `/api/trips/{tripId}/packing/categories/{categoryId}` | `{ name }` | `{ category }` (endpoint exists; NO UI) |
| 8 | DELETE | `/api/trips/{tripId}/packing/categories/{categoryId}` | — | `{ ok: true }` (items cascade) |
| 9 | POST | `/api/trips/{tripId}/packing/items` | `{ categoryId, name, quantity? }` (quantity defaults 1) | `{ item }` |
| 10 | PATCH | `/api/trips/{tripId}/packing/items/{itemId}` | any of `{ name?, quantity?, packed? }` | `{ item }` |
| 11 | DELETE | `/api/trips/{tripId}/packing/items/{itemId}` | — | `{ ok: true }` |

Shapes: `Task = { id, tripId, title, note: string|null, done: boolean, orderIndex, createdAt, updatedAt }`; `PackingItem = { id, categoryId, name, quantity, packed, orderIndex, createdAt, updatedAt }`; `PackingCategoryDTO = PackingCategory & { items: PackingItem[] }`. Timestamps are DB seconds serialized via JSON — treat as opaque; never displayed in this section. Formatting rules in scope: counts as `{packed}/{total}` tabular-nums; quantities are plain integers (min 1, max 9999); no money, distances, or dates appear anywhere in To-do.