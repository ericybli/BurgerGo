# home parity spec

Source of truth (web): `/Users/eric/own/BurgerGo/app/(home)/layout.tsx`, `app/(home)/page.tsx`, `components/HomeClient.tsx`, `components/TripCard.tsx`, `components/NewTripSheet.tsx`, `components/ManageTripSheet.tsx`, `components/EmptyState.tsx`, `components/OnboardingNote.tsx`, `components/BottomTabBar.tsx`, `components/TripShellClient.tsx`, strings in `messages/en.json`.
RN targets: `/Users/eric/own/BurgerGo/expo-rn/screens/home/HomeScreen.tsx`, `expo-rn/App.tsx`, `expo-rn/navigation/TripTabs.tsx`, `expo-rn/lib/api/*`, `expo-rn/lib/theme.ts`.

## Web feature inventory (exhaustive)

### Header (home layout)
- Left: bundled logo image (`/burgergo-logo.png`, 38×36, object-contain) + title **"BurgerGo"** in `display` type (23px bold, tracking −0.03em, ink).
- Right: settings button — 36×36 round chip (`bg-surface`, `rounded-chip`), lucide `Settings` icon 18px ink, aria "Settings", press scale 0.95 → navigates to the Settings screen.

### First-run onboarding note (above list)
- Card (`rounded-card` 14, `border-line`, white bg, p-16): heading **"Welcome to BurgerGo"**; body **"Plan your trip day by day — places, map, eats, budget, packing, and a journal. Anything you've opened stays readable offline; edits need a connection. The in-app map needs the network too, so it can look blank offline — that's normal."**; orange button **"Got it"**.
- Dismiss persists key `burgergo.onboarded` = `'1'` (web: localStorage). Hidden until storage is read (no flash); never shown again.

### Trip list states (data: GET `/api/trips`, fetched on mount/focus)
- **Loading**: centered pulsing mascot (logo asset, 96×96, opacity .9) + **"Fetching your trips…"** (body, sub).
- **Error** (fetch failed): EmptyState — mascot 112×112, headline **"Couldn't load trips"**, subtext **"Connect to the internet and try again."**, orange button **"Try again"** → refetch.
- **Empty** (0 trips): EmptyState — headline **"Where to first?"**, subtext **"Plan your first trip and BurgerGo will tag along."**, orange button **"New trip"** → opens create sheet.
- **Loaded**: micro section label **"Trips"** (10.5px bold, uppercase, tracking 0.1em, faint), then card list, 12px gap, staggered fade-up entrance (delay = min(index,6)×40ms).
- Sort order is **server-side**: active trips first, then `startDate` asc, then id asc. Client must not re-sort.

### TripCard (whole card navigates to the trip)
- Container: `rounded-[18px]`, 1px `line` border, white bg, no shadow, press scale 0.99.
- Cover region, fixed **180px** tall: if `trip.coverPhoto` → image `GET /api/photos/p/{coverPhoto}/card` (cover-fit); else fallback **cover gradient** `linear-gradient(135deg, #F7F1E4 0%, #EDF1EE 55%, #E6EFF1 100%)`.
- Status pill, top-left (12px inset): white/95 chip (`rounded-chip`, px-12 py-5), 11.5px bold text; label+color by status: `upcoming`→**"Upcoming"** accent teal; `active`→**"Active"** orange; `past`→**"Past"** sub. Status: `today < startDate` upcoming, `today > endDate` past, else active (string compare on YYYY-MM-DD; today resolved in app TZ — RN: device TZ).
- Edit button, top-right: 34×34 white/95 chip, lucide `Pencil` 15px ink, aria **"Edit trip"**; opens ManageTripSheet **without** navigating (stop propagation).
- Footer row (p-16, space-between): left = trip name (19px bold, tracking −0.02em, ink, truncates) over dates line (13px sub, tabular-nums) formatted **"{start} – {end} · {days, plural, one {# day} other {# days}}"**, e.g. `Sep 4 – Sep 12 · 9 days` (en-US `MMM d`, UTC-parsed; days = inclusive: diff+1).
- Right stat box: `rounded-[12px]` 1px line border, px-12 py-7, centered; number 17px extrabold ink tabular; label 9.5px bold uppercase tracking 0.08em faint. **Upcoming** → number = days until start (`diffDays(today, startDate)`), label **"days out"**; active/past → number = trip length in days, label **"days"**.

### FAB (always visible over the list)
- Fixed bottom-right (24px insets), 56×56 round, `orange` bg, white lucide `Plus` 24, aria **"New trip"**, shadow `0 10px 24px rgb(224 80 44 / 0.35)` (the one allowed extra shadow), press → `orange-press` + scale 0.95. Opens NewTripSheet. Hidden in none of the states.

### NewTripSheet (bottom sheet; key-remounts each open so fields reset)
- Scrim `rgb(27 31 28 / 0.42)` + 3px blur; tap-outside closes; sheet: white, `rounded-t-[22px]`, p-18 pb-32, sheet shadow, fade-up entrance, grab handle (40×4 `line` chip, centered).
- Title **"New trip"** (18px bold). Fields (label 13px semibold ink; input: `rounded-control` 10, 1px line border, px-12 py-10, 14px ink, placeholder faint; focus = accent border + 3px accent-tint ring):
  - **"Trip name"**, placeholder **"Tokyo adventure"**.
  - **"Start date"** (date), **"End date"** (date, min = start).
- Validation (client, on submit): empty name → **"Please enter a trip name."**; end < start → **"End date must be on or after the start date."** Error shown in danger 12px under fields. Server failure → **"Couldn't save — please try again."**
- Footer row: **"Cancel"** (flex-1, outline: line border, white bg, ink) + **"Create trip"** (flex-1, orange, white, disabled while pending). Success → refetch list, close.

### ManageTripSheet (bottom sheet per trip; stays open across edits; each control commits independently)
- Same chrome as NewTripSheet (scrim, handle, max-height 85%, scrollable). Title **"Manage trip"**.
- Inline status line under the title after each op: success **"Saved ✓"** (accent) / failure **"Couldn't save — please try again."** (danger). All controls disabled while a write is pending.
- **Rename**: label **"Trip name"** + text input + teal pill button **"Rename"** (disabled when empty / unchanged) → PATCH `{name}`.
- **Move dates**: heading **"Move dates"**; label **"New start date"** + date input + teal button **"Move"** (disabled when empty/unchanged) → PATCH `{startDate}` (shifts the whole window, length preserved; scheduled places shift with it). Hint: **"Moves the whole trip; scheduled places shift with it."** On success the start field syncs to the returned trip.
- **Length**: heading **"Length"**; text **"{n} days"** (ICU plural) + teal **"Remove a day"** (disabled when length ≤ 1) + orange **"Add a day"**. Hint: **"Removing the last day moves any of its places to Saved."**
- **Cover photo**: heading **"Cover photo"**. If cover → preview image (h-128, full width, `rounded-card`, line border, cover-fit, src `/api/photos/p/{id}/card`); else hint **"No cover yet — the card shows a gradient."** Buttons: teal **"Upload cover"** / **"Replace cover"** (shows **"Uploading…"** while busy; accepts images only); when cover exists, danger text button **"Remove"**.
  - Upload flow: pick image → `POST /api/photos` (multipart, ownerType `trip`, ownerId = tripId) → `PATCH {coverPhoto: photo.id}` → best-effort `DELETE /api/photos/p/{previousId}` (failures swallowed).
  - Remove flow: `PATCH {coverPhoto: null}` → best-effort delete of the old photo.
- Full-width outline button **"Close"**. Every successful change triggers a list refresh on Home.
- Note: **web has no Delete-trip control anywhere in Home** (the RN seed added one; see Gaps #12).

### Trip navigation / tab bar (entered by tapping a card)
- `/trip/:id` redirects to the **Plan** tab; Plan auto-lands on today's date for active trips, else the start date.
- Trip header: back chip + name + subtitle `"Sep 4 – Sep 12"` (same `MMM d` formatting, en dash).
- Bottom tab bar — 6 tabs, order and lucide icons (21px, strokeWidth 2) over 10px semibold label; active = `accent`, inactive = `faint`; min-height 44; top hairline `line` border; safe-area bottom padding; **no** outline/chip treatment:
  1. **Plan** — `MapPin` 2. **Eats** — `Utensils` 3. **Tickets** — `Ticket` 4. **Budget** — `CreditCard` 5. **To do** — `SquareCheck` 6. **Journal** — `Book`

## Already in RN seed (works as-is)
- `api.trips.list/get/create/update/remove` and `api.photos.upload/remove` + `photoUrl.personal()` in `expo-rn/lib/api/` (correct endpoints, `x-api-key` support).
- Refetch on screen focus; loading / error / empty states exist (copy differs).
- Create sheet with name/start/end, YYYY-MM-DD regex validation, end ≥ start, name required; key-remounted form per open; diff-only PATCH on edit (name / startDate); offline gating of writes via `lib/online`.
- Navigation skeleton: Home → Trip (bottom tabs) → per-section screens; Settings screen + header-right entry (emoji).
- Atlas Light tokens, type scale, radii, day colors already defined in `expo-rn/lib/theme.ts` (Instrument Sans names declared; Home still uses legacy aliases).
- `expo-image-picker` already a dependency (used by Journal/Eats/Plan).

## Gaps to build
1. **TripCard visual parity** — replace the text row card. Behavior: 180px cover (image `photoUrl.personal(trip.coverPhoto,'card')` else gradient — add `expo-linear-gradient`, 135deg 3-stop per above), status pill, pencil edit chip, name + formatted date line, right stat box ("days out" countdown for upcoming, else length). Data: `GET /api/trips` (already typed with `coverPhoto`). Edge cases: 1-day trip → "1 day" singular; status/today from device TZ (web uses server `env.TZ` — accept the mismatch); cover image 404 (deleted photo) → fall back to gradient.
2. **Preserve server sort** — render `/api/trips` order verbatim (active first, then startDate, then id). Remove any client sorting.
3. **Exact copy + mascot states** — bundle `public/burgergo-logo.png` into `expo-rn/assets`; loading = pulsing 96px mascot + "Fetching your trips…"; error = mascot 112px + "Couldn't load trips" / "Connect to the internet and try again." / orange "Try again"; empty = "Where to first?" / "Plan your first trip and BurgerGo will tag along." / orange **"New trip"** button (seed's empty state lacks the CTA). Section label **"Trips"** above the list.
4. **Onboarding note** — first-run card with exact strings (§ above), "Got it" orange button; persist `burgergo.onboarded='1'` via `@react-native-async-storage/async-storage` (**new dependency**). Don't render until the flag is read.
5. **FAB** — replace footer "+ New trip" button with the 56px orange round FAB (Plus icon, bottom-right 24px inset, fab shadow, press-darken). Keep offline-disable behavior (web has none — FAB always active; pick web behavior: always enabled, surface the save error instead).
6. **Header parity** — custom Home header: logo asset + "BurgerGo" display type; right gear = lucide `Settings` (add `lucide-react-native`, **new dependency**, use it for all home icons: Settings/Pencil/Plus) in a 36px `surface` chip → Settings screen.
7. **ManageTripSheet rebuild** — split the single edit form into per-control commits (Rename / Move / ±day / Cover) with "Saved ✓" inline status, sheet stays open, list refreshes after each success (`onChanged`). Endpoints: PATCH name, PATCH startDate. Edge: disable buttons when unchanged/empty/pending; 404 (trip deleted elsewhere) → show save error.
8. **Add/remove day — backend gap.** `addTripDayAction`/`removeTripDayAction` have **no REST mirror**; PATCH `/api/trips/:id` only accepts `name|startDate|coverPhoto`. Required backend change (in main repo, `app/api/trips/[tripId]/route.ts`): extend PATCH to accept e.g. `{ addDay: true }` / `{ removeDay: true }` wrapping those actions (keeps the places-to-Saved semantics of `removeTripDayAction` — do **not** emulate via endDate math client-side). RN then adds `api.trips.addDay/removeDay`. Edge: removeDay at length 1 → server error → "Couldn't save".
9. **Cover upload/replace/remove** — widen `api.photos.upload` ownerType union to include `'trip'` (server already allows it); flow per § Manage sheet using `expo-image-picker` (`mediaTypes:['images']`, quality ~0.85). Map server errors: 413 `too_large`, 415 `unsupported_type`/`invalid_image`, 409 `too_many` (12-photo cap per owner) → show save error. Old-photo delete is fire-and-forget.
10. **Trip tab bar parity** — restyle `expo-rn/navigation/TripTabs.tsx`: icon-over-label (lucide-react-native, 21/2px), active `accent` / inactive `faint`, hairline top border on white, drop the coral outline-chip treatment; **add the Tickets tab** (order Plan/Eats/Tickets/Budget/To do/Journal). Tickets screen content is out of scope here — stub it if the section spec isn't ready.
11. **Trip header subtitle** — when navigating, pass dates and render subtitle `"{MMM d} – {MMM d}"` under the trip name (web TripShellClient).
12. **Delete-trip divergence** — web Home offers no delete UI. For exact parity remove the seed's "Delete trip" button (endpoint `DELETE /api/trips/:id` stays available); if product wants to keep it, keep it behind the manage sheet with the existing confirm — flag for the caller to decide.
13. **Date formatting helper** — port `formatRange` (en-US `MMM d`, UTC parse of `YYYY-MM-DDT00:00:00Z`, inclusive day count) and `diffDays`/`tripStatus` from `src/lib/days.ts` into `expo-rn/lib/days.ts` (some helpers already exist there — verify/extend rather than duplicate).

## Atlas Light styling notes for this section
- Tokens (already in `expo-rn/lib/theme.ts`): `bg` #FFFFFF, `surface` #F4F5F2, `ink` #1B1F1C, `sub` #6E746E, `faint` #A8ADA7, `line` #E9EBE6, `accent` #33677A (+`accentTint` #E6EFF1), `orange` #E0502C (+press #C84624), `danger` #B3402C, scrim rgba(27,31,28,0.42). **Migrate HomeScreen/TripTabs off legacy aliases** (`card`/`coral`/`paper`/`inkMuted`) — those map 1:1 but should read canonically.
- Color discipline: **accent (teal) = info/navigation/inline confirm buttons** (Rename/Move/Remove-a-day, "Saved ✓", active tab); **orange = create/save only** (FAB, Create trip, Add a day, empty-state CTAs, Got it). Never swap.
- Cards/inputs: 1px hairline `line` borders on white, **no card shadows** (delete the seed's card shadow/elevation). Allowed shadows only: bottom sheet (`0 -12 40 rgba(27,31,28,0.25)`) and the FAB orange glow.
- Radii: card 14, control 10, sheet top 22, chip/pill 999; TripCard outer is 18, its stat box 12 (intentional one-offs).
- Type: Instrument Sans only (`theme.type` scale; pair `fontFamily` with weight-specific names, never `fontWeight` alone — **App.tsx must actually load the fonts via `useFonts` from `@expo-google-fonts/instrument-sans`**, currently not wired). Tabular numerals for dates/counts (`fontVariant: ['tabular-nums']`).
- Pills over imagery: white at 95% opacity, role-colored text. Cover fallback: cream→sage→teal-tint gradient (135deg, stops 0/55/100%).
- Pressed states: opacity/scale (0.95–0.99), no ripple color changes; disabled = 40–60% opacity or `surface` bg + `faint` text.

## API surface
Base `https://eric.month2month.com/burgergo`; writes send `x-api-key` when `WRITE_KEY` set; write errors: 401 `{error:'unauthorized'}`, 400 `{error:'invalid_input',message}`, 404 `{error:'not_found',message}`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/trips` | — | `Trip[]` (sorted: active, startDate, id) |
| POST | `/api/trips` | `{name, startDate, endDate}` | `{trip}` |
| GET | `/api/trips/{tripId}` | — | `{trip, days}` |
| PATCH | `/api/trips/{tripId}` | any of `{name}`, `{startDate}`, `{coverPhoto: string\|null}` | `{trip}` (final state) |
| PATCH | `/api/trips/{tripId}` | `{addDay:true}` / `{removeDay:true}` | **does not exist yet — backend change required (Gap 8)** |
| DELETE | `/api/trips/{tripId}` | — | `{ok:true}` |
| POST | `/api/photos` | multipart: `image` file, `tripId`, `ownerType:'trip'`, `ownerId`=tripId | 201 `{photo}`; errors `missing_image`/`bad_request` 400, `too_large` 413, `unsupported_type`/`invalid_image` 415, `too_many` 409, `not_found` 404 |
| DELETE | `/api/photos/p/{photoId}` | — | `{ok:true}` |
| GET | `/api/photos/p/{photoId}/{size}` | size ∈ `thumb\|card\|full` | image bytes (cover uses `card`) |

Formatting rules recap: dates `MMM d` en-US, parsed as UTC midnight, en dash between, ICU plural `# day/# days`, inclusive day counts (`diff+1`); `YYYY-MM-DD` string comparison for status; all numerics tabular; money is integer minor units app-wide (not used on Home); no distances on Home; list order comes from the server.