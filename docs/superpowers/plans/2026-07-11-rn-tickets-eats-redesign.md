# expo-rn Tickets + Eats visual redesign — Implementation Plan

> **For agentic workers:** subagent-driven. Steps use `- [ ]`. Visual-only: NO functional/data/API changes, NO new model fields. Gates per task: `cd expo-rn && npm run typecheck` (NEVER bare tsc) + `npx expo export --platform ios`.

**Goal:** Restyle the Tickets and Eats tabs to the approved boarding-pass / photo-led concepts (`expo-rn/docs/handoff/tickets-eats/*.png`) using existing data, kit, and Atlas Light + liquid-glass tokens.

**Branch:** `feature/rn-tickets-eats` off master.

---

## Design decisions (locked — honest constraints from the code)

1. **Tickets have no `category` field** → NO per-category glyph/color and NO fake QR. The card header band is: **first image attachment** (rendered via `api.tickets.fileUrl(id)` — that GET route is tokenless, so `<Image>` loads it directly) shown over a **gradient fallback** (deterministic warm gradient from a hash of the ticket title, so it always renders + degrades gracefully offline). PDF-only / no-file tickets show the gradient + a generic 🎟️ glyph. The decorative "barcode/stub" is a subtle texture only — never presented as scannable.
2. **Friendly date/time**: add a `formatTicketWhen(date, time)` helper → "Sat, Jun 6 · 6:30 PM" (raw strings shown today). UTC-stable parse like `longWeekday`.
3. **Tickets group by day**: keep the existing (date,time) sort; render day-group headers (`SAT · JUN 6`) with a timeline dot; undated tickets group last under `Anytime`.
4. **Tickets tap → Edit** stays (no net-new read-only detail screen; the boarding-pass card carries the info). Also **pin the TicketSheet Cancel/Save footer** (currently scrolls).
5. **Eats list card — NO open-now.** `openNow` is only available via a per-place live `fetchPoiLive` call (network, N calls, offline-broken) and is NOT in the list DTO; stored `googleHours` are opaque display strings, not parseable. So the list card shows the **rating we already have** instead: personal ★ (for `been`, from `rating`) or Google ★+count (from `googleRating`/`googleRatingCount`). Open-now stays in the **detail** (live call already there).
6. **Eats detail** keeps ALL existing logic/handlers (live hours effect, status toggle, day picker, unschedule, edit handoff, photos, delete) — this is a restyle only: photo hero to the top, two rating chips, keep the open-now/hours block, add an address row, pin the action footer.
7. **Photos are tokenless** (`photoUrl.*`, `restaurantThumb`, `fileUrl`) → `<Image>` renders them directly; offline-first via `localPhotoUri`. Always render a gradient/placeholder band behind images so a missing/slow photo degrades cleanly.

---

## Shared helper (Task 0)

### Task 0: name→gradient + ticket date formatter
**Files:** create `expo-rn/lib/uiHash.ts`; create `expo-rn/screens/tickets/ticketFormat.ts`

- [ ] `lib/uiHash.ts`:
```ts
/** Deterministic warm-gradient pair from any string (photo-less card bands). */
const WARM: [string, string][] = [
  ['#E8A15C', '#B5542F'], ['#7FA07A', '#3F6B52'], ['#D6B78C', '#9A6B45'],
  ['#C98A6B', '#8A4A38'], ['#9AA98F', '#5E7454'], ['#D9A24E', '#A66A2E'],
];
export function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return WARM[Math.abs(h) % WARM.length]!;
}
```
- [ ] `screens/tickets/ticketFormat.ts`:
```ts
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "Sat, Jun 6 · 6:30 PM" from stored YYYY-MM-DD / HH:MM (either may be null). */
export function formatTicketWhen(date: string | null, time: string | null): string {
  const parts: string[] = [];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T00:00:00Z`);
    parts.push(`${WD[d.getUTCDay()]}, ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`);
  } else if (date) parts.push(date);
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const ap = h! < 12 ? 'AM' : 'PM';
    const h12 = h! % 12 === 0 ? 12 : h! % 12;
    parts.push(`${h12}:${String(m).padStart(2, '0')} ${ap}`);
  } else if (time) parts.push(time);
  return parts.join(' · ');
}

/** Group key for the day header: the date (YYYY-MM-DD) or 'anytime'. */
export const ticketDayKey = (date: string | null) => date ?? 'anytime';

/** "SAT · JUN 6" header label; 'Anytime' for undated. */
export function ticketDayLabel(key: string): string {
  if (key === 'anytime') return 'Anytime';
  const d = new Date(`${key}T00:00:00Z`);
  return `${WD[d.getUTCDay()]!.toUpperCase()} · ${MO[d.getUTCMonth()]!.toUpperCase()} ${d.getUTCDate()}`;
}
```
- [ ] Gate + commit `feat(expo-rn): ui gradient hash + ticket date formatting helpers`.

---

## Tickets

### Task 1: Boarding-pass TicketCard
**Files:** modify `expo-rn/screens/tickets/TicketsScreen.tsx` (the `TicketCard` component + its styles only)

Rebuild `TicketCard` as a boarding-pass card (keep the `FadeUp` wrapper, `index`, `online`, `confirming`, `onEdit`, `onDelete` props and the two-tap delete behavior EXACTLY):
- [ ] **Header band** (height ~92, rounded top): a `LinearGradient` (from `expo-linear-gradient`) using `gradientFor(ticket.title)`; if the ticket has a file with `mime` starting `image/`, render `<Image source={{uri: api.tickets.fileUrl(file.id)}} style={StyleSheet.absoluteFill} resizeMode="cover" />` ON TOP of the gradient (gradient is the fallback if it fails/offline). Overlay: a glass chip (top-left) with 🎟️ glyph; top-right a white pill with `formatTicketWhen(...)` (or nothing if no date/time).
- [ ] **Perforation**: a thin row with two `colors.bg` half-circle cutouts on the sides + a dashed `colors.line` line (see the concept CSS `.perf`; in RN use two absolutely-positioned circles with `backgroundColor: colors.bg` overlapping the card edges + a dashed border View or a row of small dots).
- [ ] **Stub** (white, padded): `title` (17, bold), location row (📍 + `ticket.location`) if present, note (2 lines) if present, then a meta row: left = file-count pill (`📎 N files` in `accentTint`/`accent`) when `files.length`, right = the Edit/Delete actions (keep the exact two-tap Delete + Edit `Pressable`s and their disabled/confirming styles).
- [ ] Image attachments beyond the hero: keep the existing behavior of opening files via `Linking.openURL(api.tickets.fileUrl(f.id))` — expose them as small tappable thumbnail chips in the stub (image files → tiny `<Image>` chip; pdf → a `FileText` chip), replacing the old plain `fileRow` list. Tapping still `Linking.openURL`s. Preserve `numberOfLines`/keys.
- [ ] Card container: `borderRadius: 20`, `overflow:'hidden'`, hairline border, soft shadow (match RestaurantCard-era shadow / the glass plate lift is not needed here).
- [ ] Import `LinearGradient` from `expo-linear-gradient` (already a dep) and `gradientFor` from `../../lib/uiHash`, `formatTicketWhen` from `./ticketFormat`.
- [ ] Gate + commit `feat(expo-rn): boarding-pass ticket cards (photo/gradient hero, perforated stub)`.

### Task 2: Group tickets by day + pin the sheet footer
**Files:** modify `expo-rn/screens/tickets/TicketsScreen.tsx` (list render) + `expo-rn/screens/tickets/TicketSheet.tsx` (footer)

- [ ] In `TicketsScreen`, replace the flat `tickets.map(...)` with day-grouped rendering: build ordered groups keyed by `ticketDayKey(t.date)` preserving the existing sort (dated ascending, `anytime` last). Before each group render a header row: a `colors.accent` timeline dot (`accentTint` halo) + `ticketDayLabel(key)` (micro uppercase) + a hairline rule + `N ticket(s)` count. Keep the `FadeUp` stagger index continuous across the whole list. Empty/loading/error states, header row, AddTicketButton, and the Sheet mount stay identical.
- [ ] In `TicketSheet.tsx`, pin Cancel/Save: restructure the root from a single `ScrollView` (footer inside) to `View(panel, maxHeight 85%) → handle → ScrollView(flexShrink:1, fields) → footer(View, pinned, hairline top border, safe-area bottom padding via useSafeAreaInsets)`. EXACT pattern already used in `screens/plan/PlaceDetailSheet.tsx` — read it and mirror. Keep every field, the attach buttons, error banner, and the save/upload flow byte-identical; only the container structure + footer position change.
- [ ] Gate + commit `feat(expo-rn): group tickets by day (timeline) + pinned ticket-sheet footer`.

---

## Eats

### Task 3: Photo-led RestaurantCard
**Files:** rewrite `expo-rn/screens/eats/RestaurantCard.tsx`

Replace the flat hairline row with a photo-led card (keep props `{ restaurant, onTap }` and the `onTap` Pressable):
- [ ] **Photo band** (height ~176, rounded top): gradient `gradientFor(restaurant.name)` as base; `const thumb = restaurantThumb(restaurant, 'card')`; if `thumb`, `<Image absoluteFill cover>` on top. Bottom scrim gradient for text legibility.
- [ ] **Overlays**: top-left status pill (`Want to try` accentTint-on-white glass / `✓ Been` success). Top-right rating pill (glass dark): if `been` and `ratingStars(rating)` → your ★ (gold `dayColor(2)` filled + faint empty); else if `googleRating != null` → `★ {googleRating.toFixed(1)} · {googleRatingCount?}` ; else omit. Bottom overlay: `name` (21, bold, white, shadow) + `cuisine · {priceLevelLabel(priceLevel)}` (white 90%).
- [ ] **Footer** (white, only rendered if there's content): if `scheduledDayDate` → a teal `📅 Day N`… but the card only has the date string, not the day number — show `📅 Scheduled` chip (accent) instead (day number needs the trip's day list which the card lacks; keep it to a "Scheduled" chip). If nothing to show, render no footer (card is just the photo). Notes snippet (1 line, `colors.sub`) may fill the footer-left when present.
- [ ] Do NOT show open-now (see decision 5). Keep `FadeUpRow` wrapper in EatsScreen as-is (unchanged).
- [ ] Gate + commit `feat(expo-rn): photo-led restaurant cards (status + rating + scheduled)`.

### Task 4: RestaurantDetail restyle (logic unchanged)
**Files:** modify `expo-rn/screens/eats/RestaurantDetail.tsx` (render + styles only — DO NOT touch the effects/handlers)

- [ ] Move the hero photo to the TOP of the panel content (right after the drag handle, before the title): full panel width, ~200px, rounded top corners, gradient `gradientFor(name)` fallback behind `restaurantThumb(r,'full')`. Keep the fullscreen viewer + gallery below unchanged.
- [ ] Title + meta row (cuisine · price · status) as now.
- [ ] **Two rating chips** side by side: "YOUR RATING" (`ratingStars` gold, or "No rating") and "GOOGLE" (`googleRating.toFixed(1)` · count) — bordered `radius.control` chips. Only render the Google chip when `googleRating != null`.
- [ ] Keep the **open-now/hours block EXACTLY** (the `live`/`storedHours`/`hoursOpen` logic and JSX) — just may restyle its container to match (bordered card, green/red open text). Do not change the effect.
- [ ] **Address row** (net-new, uses existing `restaurant.address`): a bordered row with a 📍 glyph + address text; tap → `Linking.openURL` a maps URL. Reuse `placeUrl`/`googleMapsUrl` if a helper exists (check `lib/googleMapsUrl.ts`); else build `https://www.google.com/maps/search/?api=1&query=<address or lat,lng>`. Only when `address` present. NO fake map tile.
- [ ] Keep notes, gallery, add-photo, status toggle, day picker, unschedule, edit, delete, cancel — but move the primary actions (status toggle + "Add to a day") into a **pinned footer** (same `View→ScrollView→footer` restructure as Task 2; safe-area bottom). Secondary actions (edit/delete/cancel/photos) may stay in the scroll. Preserve the `onChanged`/`onPhotoChanged` close-vs-stay semantics.
- [ ] Gate + commit `feat(expo-rn): restaurant detail restyle — top hero, rating chips, address, pinned footer`.

### Task 5: Pin the RestaurantForm footer
**Files:** modify `expo-rn/screens/eats/RestaurantForm.tsx`

- [ ] Same pinned-footer restructure as Task 2/PlaceDetailSheet: `View(panel) → handle → ScrollView(fields incl. autocomplete) → footer(Cancel/Save, hairline top, safe-area bottom)`. Keep every field, the autocomplete suggestions list, and the save/geocode flow byte-identical.
- [ ] Gate + commit `feat(expo-rn): pinned restaurant-form footer`.

---

### Task 6: Final gates + visual pass + OTA
- [ ] `npm run typecheck` + `npx expo export --platform ios` + `--platform web`.
- [ ] Controller visual pass on `npm run web` (backend + expo web already run locally): create a couple of restaurants (with/without photo, been vs want, scheduled) and a couple of tickets (with image attachment, PDF-only, undated) via the API, screenshot Eats list + a restaurant detail + Tickets list. Compare to the concept PNGs.
- [ ] Merge to master, `eas update --channel preview -m "Tickets + Eats redesign"` (pure JS → OTA), hand the note to Eric.

## Self-review
- Visual-only: T1/T3 rewrite card render; T2/T4/T5 restructure sheet containers + restyle; no api/model/handler changes. ✓
- Honest constraints encoded: no ticket category (gradient/photo hero), no list open-now (rating instead), no fake QR/map tile. ✓
- Reused helpers: `gradientFor`, `formatTicketWhen`, `ratingStars`/`priceLevelLabel`/`restaurantThumb`/`parseStoredHours`/`fetchPoiLive` (unchanged). ✓
