# settings parity spec

Section: Settings (web `app/(home)/settings/page.tsx` → `components/SettingsClient.tsx`; RN `expo-rn/screens/settings/SettingsScreen.tsx`). All persisted settings here are **global** (single server row, `settings` table id=1). There are **no device-local settings on this page** (the only device-local preference in the app — itinerary density, `localStorage bg.itineraryDensity` — lives on the Plan screen, not here). Online/offline gating is device state, not a setting.

## Web feature inventory (exhaustive, grouped by UI region)

### Header
- Back button: 44×44 chevron-left (lucide `ChevronLeft` 24/1.75), aria-label "Back", navigates to Home. Title: "Settings" (`text-title text-ink`).

### Card 1 — Language & Currency (one card, divider between rows)
- Row "Language" → read-only value "English" (right-aligned, `text-label text-sub`). No control; i18n was dropped, English-only. Never editable.
- Divider: hairline `border-t border-line`.
- Row "Currency" → `<select>` of `CURRENCIES` (16 entries, fixed array order, USD first — NOT alphabetized): option label format `"{code} · {label}"` (e.g. `USD · US Dollar`). If the stored currency is not in the list, it is appended as an extra option (label = bare code) so it stays selectable.
- Saves **immediately on change** (no Save button). Optimistic: UI value set first; on error the selection is *not* reverted (unlike the map toggle).
- Status line under the row (one of three): idle hint "Used for all amounts across the trip." (`text-faint`); saved "Currency saved ✓" (`text-accent`); error "Couldn't save — please try again." (`text-danger`).
- Control disabled when offline or a save is pending.
- Global effect: drives ALL money formatting app-wide (Budget, place costs).

### Card 2 — Map
- Heading "Map" (`text-heading text-ink`).
- Toggle row (whole row is the tap target; hover `bg-accent-tint/40`): label "Cluster nearby pins" (`text-body text-ink`) + hint "Group close-together pins into a count bubble that splits apart as you zoom in. Turn off to always show every pin." (`text-caption text-sub`). Checkbox 20×20, `accent-accent`.
- Semantics: `clusterPins` null/undefined/true → ON (default); only explicit `false` → OFF. Checked state = `row?.clusterPins !== false`.
- Saves immediately on toggle. Optimistic **with revert on failure** (toggle flips back).
- Status: saved "Saved ✓" (`text-accent`); error "Couldn't save — please try again." (`text-danger`); idle → nothing.
- Disabled when offline/pending. Global effect: Plan▸Map pin clustering.

### Card 3 — AI place summaries
- Heading "AI place summaries"; body "Customize how AI writes each place's intro. Leave blank to use the built-in defaults." (`text-caption text-sub`).
- "Model" label + select of `AI_MODELS` = `['gpt-5.5-pro', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano']` (this order). Stored value coerced: if not in list (or null) → show `DEFAULT_AI_MODEL` = `gpt-5.4-mini`.
- "Prompt" label + textarea (8 rows), placeholder = `DEFAULT_AI_PROMPT` (the full built-in Chinese system prompt — shown as placeholder, never as value). Hint below: "The system prompt. Leave blank for the built-in Chinese, beginner-friendly default." (`text-caption text-faint`).
- Editing model or prompt resets status to idle.
- Buttons row: "Save" (solid orange button — this is the create/save action) + "Reset to default" (plain text button, `text-accent`; **local-only**: clears prompt to '' and model to default, does NOT call the API — user must still hit Save to persist).
- Status inline next to buttons: saved "Saved" (`text-sub`, role=status); error "Couldn't save — please try again." (`text-danger`, role=alert).
- All controls disabled when offline/pending. Blank prompt/model on save → stored as NULL (clears override). Limits: prompt ≤ 8000 chars, model trimmed ≤ 100 chars.

### Card 4 — About (centered)
- App logo 88×88 (opacity 0.9), app name "BurgerGo" (`text-heading`), tagline "Your personal travel companion" (`text-caption text-sub`), "Version {APP_VERSION}" (`text-caption text-faint`, tabular-nums).

### Card 5 — Offline & install + Your data (ONE card, two blocks split by hairline divider)
- Block 1: heading "Offline & install"; body (web copy) "Works offline for reading. Installing the app and using your location need HTTPS or localhost."
- Divider `border-t border-line`, then Block 2: heading "Your data"; body "All your data lives in a SQLite database on your own server."; sub-line "Back it up by copying that database file." (`text-faint`).

### Cross-cutting behavior
- Page is a static shell; client fetches `GET /api/settings` on mount. Fetch failure (offline, no cache) → silently keep defaults (English / USD / cluster ON / empty prompt / default model). Web shows the form immediately with defaults; RN seed shows a `Loading` state until the fetch settles (acceptable RN adaptation).
- One shared `isPending` disables ALL controls during any save (web). RN uses per-card busy flags — acceptable.

## Already in RN seed (works as-is)
- `GET` load on mount via `api.settings.get()` with silent offline fallback + `Loading` state (`expo-rn/screens/settings/SettingsScreen.tsx`).
- Card 1 Language (read-only "English") + Currency `Select` with `"{code} · {label}"` labels, stored-code-outside-list prepend, optimistic immediate save, exact status strings ("Currency saved ✓" / error / hint), offline+busy disable, `OfflineHint`.
- Card AI: model Select (same `AI_MODELS`/coercion, `expo-rn/lib/aiDefaults.ts` verbatim copy), prompt multiline Field with `DEFAULT_AI_PROMPT` placeholder, correct hint copy, Save + local-only "Reset to default", status handling, edit-resets-status.
- About card (88px logo, name, tagline, "Version 1.0.0" tabular-nums from `expo-rn/lib/appVersion.ts`).
- "Your data" copy matches web exactly.
- `api.settings.get/update` client exists (`expo-rn/lib/api/index.ts` lines 201–205) for currency/prompt/model.
- `expo-rn/lib/currency.ts` already implements minor-units money helpers + the 16-entry `CURRENCIES` list in web order.
- `expo-rn/lib/theme.ts` already has the full Atlas Light token set, `DAY_COLORS`, Instrument Sans `font` map, and Atlas `type` scale — ready to use.

## Gaps to build

1. **Map card with "Cluster nearby pins" toggle** (missing entirely).
   - Behavior: new card between Currency and AI cards (web order: Language&Currency → Map → AI → About → Offline/Data). Heading "Map". RN `Switch` (or styled checkbox) with label "Cluster nearby pins" + the exact hint string above. Checked = `row?.clusterPins !== false`. On toggle: optimistic flip → `PATCH /api/settings { clusterPins }` → on success show "Saved ✓" (accent), on failure **revert the toggle** and show "Couldn't save — please try again." (danger). Disabled when offline/busy; show `OfflineHint` when offline.
   - Data: `clusterPins` field on the settings row (`cluster_pins`, boolean, nullable).
   - Edge cases: null/undefined means ON; never send anything but a real boolean; whole row should be tappable.

2. **`Settings` type missing `clusterPins`** (`expo-rn/lib/api/types.ts` ~line 218).
   - Add `clusterPins: boolean | null;` (server GET returns it; coalesce null→true at the screen). Also note GET can return `null` (no row yet) — already typed.

3. **`api.settings.update` patch type missing `clusterPins`** (`expo-rn/lib/api/index.ts` line 203).
   - Widen to `Partial<{ currency: string; prompt: string | null; model: string | null; clusterPins: boolean }>`. PATCH is partial-safe server-side: a currency save never wipes AI overrides and vice-versa, so per-card saves can stay independent.

4. **Merge "Offline & install" + "Your data" into one card** with a hairline divider between blocks (web has 5 cards total, RN currently 5 but split differently). Keep RN-appropriate offline copy ("Works offline for reading. Editing your trip needs a connection.") — the web's HTTPS/install sentence is PWA-only; flag as intentional deviation, don't copy it.

5. **Atlas Light restyle of the screen + the `ui/index.tsx` recipes it uses** (Card/Button/Select/Field still pre-redesign: Card has a drop shadow, primary button uses `colors.coral`, paper/card aliases). See styling notes below. Status-color fix: "Currency saved ✓" and map "Saved ✓" must be `colors.accent` (RN currently uses `colors.success`); AI "Saved" is `colors.sub`; errors `colors.danger`; idle hints `colors.faint`/`colors.sub` per the web mapping above.

6. **Header parity**: web shows a back chevron + "Settings" title. RN Settings is a tab — render the "Settings" title via the navigator header or an in-screen `type.title` heading; no back button needed (intentional adaptation).

7. **Edge cases to preserve**: blank prompt/model → server stores NULL (don't pre-trim client-side; server handles it); unknown stored model → display default but do NOT auto-save the coercion; saving AI always sends BOTH `prompt` and `model` (web sends both keys together — required because the action treats key-presence as intent); currency save does not revert on error (web behavior) while cluster toggle does.

### Formatting rules (this section)
- Money: integer minor units everywhere; settings only selects the ISO-4217 code (3 letters, uppercased server-side). Use `formatMoney` from `expo-rn/lib/currency.ts` elsewhere; nothing on this screen renders money.
- Currency list: fixed source order (USD, EUR, GBP, JPY, CNY, HKD, TWD, KRW, SGD, THB, AUD, CAD, CHF, NZD, MXN, INR) — never sort.
- AI model list: fixed source order (pro → nano).
- Version string: tabular-nums.
- No dates/times/distances rendered in Settings (app-wide rules — miles for distances, DB timestamps in seconds — don't apply here).

## Atlas Light styling notes for this section
- Screen bg `colors.bg` (#FFFFFF). Cards: bg white, `borderWidth: StyleSheet.hairlineWidth` (or 1) `borderColor: colors.line`, `borderRadius: 14`, padding 16, **no shadow** (delete the current Card `shadow*`/`elevation` — Atlas allows shadows only on segmented-control thumbs and sheets).
- Web class → RN token map: `bg-bg`→`colors.bg`; `bg-surface`→`colors.surface`; `text-ink`→`colors.ink`; `text-sub`→`colors.sub`; `text-faint`→`colors.faint`; `border-line`→`colors.line`; `text-accent`/checkbox accent→`colors.accent` (#33677A, teal = info/nav/saved-status); `bg-orange`/`bg-orange-press`→`colors.orange`/`colors.orangePress` (#E0502C/#C84624 — **create/save buttons ONLY**, i.e. the AI "Save" button; nothing else on this screen is orange); `text-danger`→`colors.danger` (#B3402C); `accent-tint`→`colors.accentTint`.
- Type: use `type` fragments from `expo-rn/lib/theme.ts` — page title `type.title` (19/bold), card headings `type.heading` (15/semibold), rows `type.body` (13.5/regular), select/labels `type.label` (13/semibold), hints/status `type.caption` (12/medium). Always set `fontFamily` from `font.*` (Instrument Sans) — never bare `fontWeight`.
- Controls: select/input fields `borderRadius: 10` (`rounded-control`), 1px `colors.line` border, white bg; focus state = accent border (web adds a 3px `accent-tint` ring — approximate with `borderColor: colors.accent`). Disabled = 0.6 opacity.
- Buttons: AI Save = solid orange, white `type.label` text, `borderRadius: 10`, pressed → `orangePress`; disabled → `colors.surface` bg + `colors.faint` text. "Reset to default" = borderless text button in `colors.accent`.
- Switch (cluster toggle): track/thumb tinted with `colors.accent` when on (`trackColor: { true: colors.accent }`).
- Dividers inside cards: `StyleSheet.hairlineWidth` in `colors.line`.
- Purge legacy aliases (`coral`, `paper`, `card`, `inkMuted`, `success`) from this screen and the ui recipes it touches; canonical tokens already exist at the top of `expo-rn/lib/theme.ts`.

## API surface
All under the deployed base (`https://eric.month2month.com/burgergo`); writes require `x-api-key` only if `BURGERGO_API_KEY` is set (401 `{ error: 'unauthorized' }` otherwise open).

| Call | Method + path | Body | Returns |
|---|---|---|---|
| Load settings | `GET /api/settings` | — | `Settings \| null` — `{ id, language: 'en'\|'zh', currency, aiPrompt: string\|null, aiModel: string\|null, clusterPins: boolean\|null, ... }` |
| Save currency | `PATCH /api/settings` | `{ "currency": "EUR" }` | `{ settings: Settings \| null }` |
| Save AI overrides | `PATCH /api/settings` | `{ "prompt": "<text or \"\" to clear>", "model": "gpt-5.4-mini" }` (send both keys) | `{ settings: ... }` |
| Toggle clustering | `PATCH /api/settings` | `{ "clusterPins": false }` | `{ settings: ... }` |

- PATCH is partial: only keys present are touched (`currency` / `prompt`+`model` / `clusterPins` can be combined or sent alone). Validation server-side: currency must match `/^[A-Z]{3}$/` after trim+uppercase; prompt ≤8000; model trimmed ≤100; blank prompt/model → NULL (built-in defaults resume). Errors: 400 `{ error: 'invalid_input', message }` (zod), 400 `{ error: 'bad_request' }` (malformed JSON), 404 `{ error: 'not_found', message }` (n/a here).
- Key files: web `components/SettingsClient.tsx`, `app/api/settings/route.ts`, `app/_actions/settings.ts`, `src/lib/openai/defaults.ts`, `src/lib/currency.ts`, `messages/en.json` (settings.*); RN `expo-rn/screens/settings/SettingsScreen.tsx`, `expo-rn/lib/api/{index,types}.ts`, `expo-rn/lib/{currency,aiDefaults,theme,appVersion}.ts`, `expo-rn/components/ui/index.tsx`.