# budget parity spec

Source of truth: `/Users/eric/own/BurgerGo/components/budget/{BudgetClient,BudgetSummary,ExpenseSheet,SetBudgetSheet}.tsx`, math in `/Users/eric/own/BurgerGo/src/lib/budgetView.ts`, money in `/Users/eric/own/BurgerGo/src/lib/currency.ts`, labels in `/Users/eric/own/BurgerGo/messages/en.json` (`budget.*`). RN target: `/Users/eric/own/BurgerGo/expo-rn/screens/budget/BudgetScreen.tsx`.

## Web feature inventory (exhaustive, grouped by UI region)

### Load / connectivity shell
- Single fetch on mount: `GET /api/trips/:tripId/budget` → `{ expenses, targets, places, currency }`. The `currency` in the response (user's Settings currency) **overrides** any seeded default once loaded.
- Loading: centered text `"Loading your budget…"` (sub color).
- Error: EmptyState (mascot) — headline `"Couldn't load this budget"`, subtext `"Connect to the internet and try again."` (web has no retry button; RN's added Retry is an acceptable extra).
- Online tracking: when offline, ALL mutations disabled — Add expense button, row tap-to-edit, swipe actions, sheet inputs + Save/Delete; sheets show hint `"Connect to the internet to make changes."`.

### Summary card (top)
- One bordered card (`rounded-[16px] border border-line bg-bg px-4 py-3.5`), containing:
  - Header row: `"OVERALL"` (micro uppercase faint) left; right button = `"Set budget"` when overall target is null, else `"Edit budget"` (bordered secondary button, NOT accent/coral text). Opens SetBudgetSheet.
  - Big amount headline (30px extrabold, tight tracking, tabular nums): if no overall target → just `formatMoney(spent)`; else `"{spent} of {planned}"`. **No "Spent" label** — the amount is the headline.
  - Overall progress bar directly under headline.
  - Remaining line under bar (left-aligned for overall): `"{amount} left"` (caption faint) / `"{amount} over"` (caption semibold danger) / `"No budget set"` (caption faint) when planned is null.
  - Per-category list (ALL 6 categories always shown, fixed order food, lodging, transport, activities, shopping, other; hairline `border-b border-line` between rows, none after last):
    - Row top: category name (14px semibold ink, truncating) left; amount right (body semibold **sub** color, tabular): `spent` or `"{spent} of {planned}"`.
    - Progress bar.
    - Remaining line, **right-aligned** for categories (same three variants as overall).
- Progress bar spec: height 5px, radius 3px, track = surface; fill = accent (teal) normally, **danger when over**; width = `clampPercent(percent)` (0 when no target); width animates 500ms spring; `role=progressbar` with aria values (RN: `accessibilityRole`/value).
- Math (`budgetView.ts`, already ported): `percent = round(spent/planned*100)` (null if planned null or ≤ 0), `remaining = planned - spent`, `over = planned != null && spent > planned`.

### Controls row (below summary)
- One row, space-between: segmented control left, `"Add expense"` button right.
- Segmented control: options `"By category"` then `"By day"`; **default = By day**. Track = surface, radius 10, 3px padding; active option = bg white + `shadow-thumb`, ink text; inactive = sub text.
- `"Add expense"`: orange filled button (white label); disabled (surface bg, faint text) when offline. Opens ExpenseSheet in add mode.

### Expense list
- Empty (no expenses at all): EmptyState — headline `"No expenses yet"`, subtext `"Tap Add expense to start tracking what you spend."`.
- **By day mode**: groups by `spentOn`, newest date first; items keep server order within a date. Section header: raw `YYYY-MM-DD` date (micro uppercase faint, tabular) left + group total `formatMoney` (caption sub, tabular) right. Sections fade-up stagger (delay `min(i,6)*40ms` — optional in RN).
- **By category mode**: fixed category order; categories with 0 expenses are **omitted**. Section header: category label only (micro uppercase faint) — **no total**.
- Expense row (flat list item, NOT a card): full-width press target, hairline bottom border, bg = bg; tap → ExpenseSheet edit mode; disabled+dimmed offline.
  - Primary: `note ?? categoryLabel` (14px semibold ink, truncate).
  - If `placeName` non-null: chip below (pill, surface bg, caption sub text).
  - Right: amount `formatMoney(amount)` (14px bold ink, tabular).
- SwipeRow actions on each row: `"Edit"` (opens edit sheet) and `"Delete"` (danger, immediate delete — **no confirm on web**; RN's Alert confirm is an acceptable platform adaptation). Swipe disabled offline. Delete = fire request then always refetch.

### ExpenseSheet (bottom sheet; add + edit)
- Remount key per open: `new` / expense id / closed — fields never carry stale state between opens.
- Title: `"Add expense"` / `"Edit expense"`; drag handle (4×40 pill, line color); scrim + rounded-top 22 + `shadow-sheet`; max height 85%.
- Error banner (role alert): bordered box, danger caption text. Offline hint line when disabled.
- Fields, in order:
  1. `"Amount"` — text input, decimal keyboard, tabular nums. Edit mode prefilled via `minorToInput(amount, currency)` (e.g. 30000¢ → `"300.00"`, JPY 1500 → `"1500"`).
  2. `"Category"` — select over the 6 categories (labels Food/Lodging/Transport/Activities/Shopping/Other); default `food` in add mode.
  3. `"Date"` — date input, default = today's local date YYYY-MM-DD in add mode.
  4. `"Note"` — free text (server max 2000).
  5. `"Link a place"` — select; first option `"None"` (empty value) + all trip places (from the budget response's `places`).
- Save: validate `inputToMinor(amount, currency)`; null (empty/non-numeric/≤0) → inline error `"Enter an amount greater than zero."` and no request. Payload: `{ amount: minor, category, spentOn, note: trimmed||null, linkedPlaceId: ''→null }`. Add → POST; edit → PATCH. Failure → `"Couldn't save — please try again."` (sheet stays open).
- Buttons (full-width stack): `"Save"` (orange, 12px radius), then in edit mode `"Delete"` (borderless danger text; failure msg `"Something went wrong — please try again."`), then `"Cancel"` (bordered). All but Cancel disabled while pending/offline.
- On save/delete success: close sheet + refetch budget.

### SetBudgetSheet (targets editor)
- Remount key per open. Title `"Set budget"`. Same sheet chrome/error/offline patterns.
- Fields: `"Overall budget"` then one per category, label `"{Category} budget"` (e.g. `"Food budget"`); decimal text inputs prefilled from current targets via `minorToInput`, empty when unset.
- Save logic (diff-based, sequential): for each key in `[overall, ...categories]`: `next = inputToMinor(value)`; skip if `next === prev`; `next === null` (cleared/invalid/empty) → DELETE target; else PUT target. Clearing a target = emptying its field; **no per-row Clear button**. Failure → `"Couldn't save — please try again."`.
- Buttons: `"Save"` (orange) then `"Cancel"` (bordered). No delete.

## Already in RN seed (works as-is)

- Full data flow: `api.budget.get` on focus, currency adopted from response, online gating, refetch after every mutation.
- Math/grouping libs ported and behavior-identical: `expo-rn/lib/budgetView.ts` (categories, rows, percent/over/remaining, `groupByDate` newest-first), `expo-rn/lib/currency.ts` (exponents 0/2/3, `minorToInput`, `inputToMinor` with >0 rule).
- Summary card with overall + 6 category bars, Set/Edit budget toggle label, remaining/over/no-target labels with exact strings.
- Segmented By category/By day (correct default `day`, correct option order); Add expense disabled offline.
- By-day groups with totals; by-category groups omitting empties in fixed order.
- ExpenseSheet equivalent: all 5 fields, correct defaults (`food`, today, prefill via `minorToInput`), correct payload null-coercion, identical validation + error strings, remount key per expense.
- SetBudgetForm: same diff-based save (skip unchanged, clear on empty, PUT on change), same labels.
- Empty/error/loading strings match.

## Gaps to build (numbered)

1. **Atlas Light retheme (biggest gap)** — RN still uses warm-editorial tokens (`coral/paper/card`, shadowed card rows). Replace `expo-rn/lib/theme.ts` palette and all budget styles per the styling section below. Edge case: progress-bar fill must become accent teal (danger when over), not coral.
2. **Summary card header/headline layout** — Behavior: header row = `OVERALL` micro-uppercase-faint + bordered `Set budget`/`Edit budget` button (currently a coral text link); overall amount becomes a 30px extrabold headline (drop the RN "Spent" label); overall remaining left-aligned, category remaining **right-aligned**; categories separated by hairline dividers (currently `marginTop` spacing). Data: existing `BudgetRow`s. Edge: planned=null → headline is spent only.
3. **Controls in one row** — segmented left + Add expense right, space-between (RN currently stacks vertically in a column).
4. **Flat hairline expense rows** — replace card rows (white card, radius 14, shadow) with full-bleed list rows: hairline bottom border, no shadow, primary 14px semibold, surface place-chip, bold tabular amount right. Remove the always-visible `✕` glyph.
5. **Swipe actions Edit/Delete on rows** — web exposes Edit + Delete via SwipeRow plus tap-to-edit; RN should use a swipeable row (e.g. `react-native-gesture-handler` Swipeable) with Edit (neutral) + Delete (danger) actions, disabled offline. Keep tap-to-edit. Keep the native Alert delete-confirm (platform-appropriate). Data: `DELETE /api/trips/:tripId/expenses/:id` then refetch. Edge: delete must always trigger refetch even on failure (web does `finally { load() }`).
6. **By-day section header styling** — date as micro uppercase faint tabular + total caption sub (RN currently bold ink/teal). By-category header gets no total (already correct).
7. **SetBudget sheet remount bug** — RN keys the form on `targets.length`; reopening after editing values (same count) shows stale fields. Key on an open-counter or open-state like web (`budget:${open}` semantics) so every open re-seeds from current targets.
8. **ExpenseSheet button stack** — match web order/layout: full-width orange Save, then Delete (danger ghost, edit only), then bordered Cancel (RN currently has a Cancel/Save side-by-side row). Sheet chrome: drag handle, radius 22 top, sheet shadow, scrim `rgba(27,31,28,0.42)`.
9. **formatMoney parity** — RN's symbol-map formatter must emit grouping separators and exponent-fixed decimals identical to web's `Intl.NumberFormat('en', { style:'currency' })` (e.g. `$1,234.56`, `¥1,500`). On Hermes, `Intl.NumberFormat` is available — prefer it; fall back to symbol map + manual grouping only if needed.
10. **Date field** — web uses a native date picker (`<input type=date>`). RN free-text `YYYY-MM-DD` is functional but should at minimum keep the placeholder and rely on server regex (`/^\d{4}-\d{2}-\d{2}$/` → 400 `invalid_input`); surface that 400 as the save-failed error. Optional: platform date picker.
11. **Error-state parity nit** — web shows error state even if previously loaded; RN keeps stale data. Keep RN behavior (better UX) but ensure first-load failure shows the exact headline/subtext strings (it does).
12. **Fade-up stagger (optional polish)** — group sections animate in (8px translate-up, 420ms spring, `min(i,6)*40ms` delay). Optional `Animated`/`Reanimated` equivalent.

## Atlas Light styling notes for this section

Token values (from `/Users/eric/own/BurgerGo/tailwind.config.ts` + `app/globals.css`) — replace warm-editorial palette in `expo-rn/lib/theme.ts`:
- `bg #FFFFFF` · `surface #F4F5F2` · `ink #1B1F1C` · `sub #6E746E` · `faint #A8ADA7` · `line #E9EBE6` · `accent #33677A` (tint `#E6EFF1`) · `orange #E0502C` (press `#C84624`) · `danger #B3402C` · `success #3E8E6E` · scrim `rgba(27,31,28,0.42)`.
- Color discipline: **accent (teal) = information** (progress fill, links); **orange = create/save only** (Add expense, Save buttons). Never swap.
- Borders: 1px hairline `line` everywhere; **no shadows on cards or rows**. Only allowed shadows: segmented active thumb (`0 1px 2px rgba(27,31,28,0.10)` + 1px ring) and bottom sheet (`0 -12px 40px rgba(27,31,28,0.25)`).
- Radii: card 14–16 (summary card uses 16), control/input/button 10, sheet top 22, chip 999, bar 3.
- Type scale: micro 10.5/700 uppercase letterSpacing ~1 (section headers `OVERALL`, dates, category headers); caption 12/500 (remaining labels, totals, chips); label 13/600 (buttons, field labels); body/row text 14/600; overall headline 30/800 tracking −0.03em; sheet titles 18/700. Tabular numerals (`fontVariant: ['tabular-nums']`) on every money/date figure.
- Specific mappings from current RN styles: `colors.card` row bg + shadow → `bg` + `borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line`; `colors.coral` edit link → bordered neutral button (border line, ink label); `colors.teal` day total → `sub`; place chip `paper` → `surface`; inputs = bg white, 1px line border, radius 10, focus border accent.
- Buttons: primary = orange bg/white label, pressed `#C84624`, disabled = surface bg + faint label; secondary = white bg + line border + ink label; danger = borderless danger text.

## API surface

All paths relative to `API_BASE` (`https://eric.month2month.com/burgergo`). Writes send `content-type: application/json` and optional `x-api-key` (only if server sets `BURGERGO_API_KEY`). Write errors: 401 `{error:'unauthorized'}`, 400 `{error:'invalid_input', message}`, 404 `{error:'not_found', message}`. All wrappers exist in `expo-rn/lib/api/index.ts` under `api.budget` — no client additions needed.

| # | Method | Path | Body / params | Returns |
|---|--------|------|---------------|---------|
| 1 | GET | `/api/trips/:tripId/budget` | — | `{ expenses: ExpenseDTO[], targets: TargetDTO[], places: {id,name}[], currency: string }` |
| 2 | POST | `/api/trips/:tripId/expenses` | `{ amount:int>0 minor, category, spentOn:'YYYY-MM-DD', note?:string\|null (≤2000), linkedPlaceId?:string\|null }` | `{ expense }` |
| 3 | PATCH | `/api/trips/:tripId/expenses/:expenseId` | partial of the POST body (sheet sends all 5 fields) | `{ expense }` |
| 4 | DELETE | `/api/trips/:tripId/expenses/:expenseId` | — | `{ ok: true }` |
| 5 | PUT | `/api/trips/:tripId/budget/targets` | `{ category: BudgetCategory\|null (null = overall), plannedAmount:int>0 minor }` — upserts | `{ target }` |
| 6 | DELETE | `/api/trips/:tripId/budget/targets?category=food` | omit `category` (or empty/`null`) to clear the overall target | `{ ok: true }` |

DTO shapes: `ExpenseDTO = { id, tripId, amount, category, spentOn, note\|null, linkedPlaceId\|null, createdAt, updatedAt, placeName\|null }`; `TargetDTO = { id, tripId, category\|null, plannedAmount, createdAt, updatedAt }`.

### Formatting / ordering rules
- **Money**: integer minor units everywhere; exponent per ISO-4217 (JPY/KRW/VND=0, KWD/BHD/JOD=3, else 2). Display via `formatMoney(minor, currency, 'en')` → Intl currency style with exponent-fixed fraction digits. Inputs: `minorToInput` (fixed precision string) / `inputToMinor` (null for empty/NaN/≤0). Currency code comes from the budget response (Settings), never hardcoded.
- **Dates**: `spentOn` is a plain local `YYYY-MM-DD`; displayed raw (no prettifying). "Today" default computed in local time (web uses `en-CA` formatter). DB timestamps are seconds — irrelevant to this UI.
- **Sort orders**: server returns expenses `spentOn DESC, createdAt DESC`; day groups = newest date first, in-group order preserved; category sections/rows = fixed `BUDGET_CATEGORIES` order; summary always lists all 6 categories, list view omits empty ones.
- Distances: not used in the budget section.