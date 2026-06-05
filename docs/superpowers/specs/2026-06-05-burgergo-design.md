# BurgerGo — Design Specification

*A private, single-user, offline-readable travel-planning PWA — cute but clean, with a Siamese cat who tags along.*

BurgerGo is a mobile-first Progressive Web App that one traveler runs on their own private server. It turns date-anchored trips into ordered daily itineraries with map pins and per-leg travel times, keeps a wishlist of backup places, tracks restaurants and actual spending, and holds a photo-rich journal with a saved-links reading list. Its defining promise is reliability: the entire plan stays fully **readable with no signal**, and the app never permits offline editing — deliberately sidestepping the sync-conflict bugs that sink lesser tools. This document is the authoritative, end-to-end design spec; an engineer should be able to read it on its own and turn it into an implementation plan. All locked product decisions are reflected here, all cross-section contradictions have been resolved, and terminology and field names are unified throughout.

---

## Table of Contents

1. [Overview, Goals & Non-Goals](#1-overview-goals--non-goals)
2. [Information Architecture & Navigation](#2-information-architecture--navigation)
3. [Screens — Home, Plan, Map & Today](#3-screens--home-plan-map--today)
4. [Screens — Eats, Budget, Journal & Settings](#4-screens--eats-budget-journal--settings)
5. [Data Model & Drizzle Schema](#5-data-model--drizzle-schema)
6. [Google Maps Integration & Cost Strategy](#6-google-maps-integration--cost-strategy)
7. [Offline & PWA Strategy](#7-offline--pwa-strategy)
8. [Technical Architecture](#8-technical-architecture)
9. [Visual Design System](#9-visual-design-system)
10. [Deployment & Operations](#10-deployment--operations)
11. [Risks, Open Questions & Phased Milestones](#11-risks-open-questions--phased-milestones)

---

### Canonical conventions (read first)

These conventions are fixed across the whole document and override any looser phrasing a reader may remember from drafts:

| Topic | Canonical decision |
|---|---|
| **Schedule field** | The locked model's `day_id` is **implemented as `day_date`** (`TEXT YYYY-MM-DD`, nullable). `day_date = NULL` means the Saved/wishlist bucket. Days are derived from trip dates, not stored. Every "day_id" mention is this field. |
| **Plan URL param** | The selected day is always **`date=YYYY-MM-DD`** in the query string (never `day=`). |
| **Route prefix** | In-trip routes are singular: **`/trip/[tripId]/…`** (plan, eats, budget, journal). Settings is **`/settings`** (home-level, app-global). |
| **Offline read model** | The service worker caches **JSON GET responses** from read Route Handlers under `/api/trips/…`. Pages fetch these endpoints; there is no separate IndexedDB mirror. |
| **Offline data strategy** | Trip-data JSON = **stale-while-revalidate**. App shell = **cache-first (versioned)**. Photos = **cache-first / immutable**. Google live calls = **network-only**. |
| **Env var names** | Browser key = `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; server key = `GOOGLE_MAPS_SERVER_KEY`; DB path = `DATABASE_PATH`; locale seed = `DEFAULT_LANGUAGE`; currency seed = `DEFAULT_CURRENCY`. |
| **Logo asset** | Source original lives at `assets/burgergo-logo.png`; the **served** copy is `public/burgergo-logo.png`, and PWA icons under `public/icons/*` are **generated from it at build**. |
| **Pin numbering** | `order_index` is 0-based and contiguous; the **displayed pin label = `order_index + 1`** (pins read 1, 2, 3…). |
| **"Today"** | Computed in the **container timezone** (`TZ` env) on both the server redirect and client day strip, so server and client never disagree on the active day. |
| **Money** | Integer **minor units** in one global currency; rendering applies a per-currency **decimal exponent** (JPY=0, USD/CNY=2, KWD=3) from an ISO-4217 exponent map. |

---

## 1. Overview, Goals & Non-Goals

### 1.1 Product summary

**BurgerGo** is a mobile-first PWA: a private, single-user personal travel-planning assistant that lives on the user's own server with no accounts and no login. It lets one traveler create and rename date-anchored **Trips**, build ordered daily **itineraries** (numbered map pins, per-leg travel times, drag-to-reorder), keep a **Saved** wishlist of backup places that promote onto a day in one tap, track **Restaurants** and **Expenses**, and write a photo-rich **Journal** with a saved-links reading list. An in-app Google map shows the trip's pins and per-day route polylines, with "Open in Google Maps" deep-links everywhere for native navigation. All trip data and uploaded photos are cached so the entire plan stays fully **readable offline**. The personality is "cute but clean," anchored by a Siamese-cat mascot (teal backpack, coral map pin) set in the warm "Sunset Wanderer" palette: Coral `#EE5B3C`, Teal `#4F8A86`, Ink `#6E5544`, Paper `#F5EEE1`, Card `#FBF7EF`, Sun `#F2C879`.

### 1.2 Who the user is

A single traveler running their own private instance. There is exactly one user — no sharing, collaboration, or roles. Content the user types (place names, notes, journal text) is free-text in any language; the UI chrome is bilingual — English + Simplified Chinese (中文), toggled in Settings.

### 1.3 Core usage scenarios

1. **Planning at home (online).** The user creates a trip with concrete `start_date`/`end_date`, searches Google Places to add stops, drops pins by long-pressing the in-app map, drags places into order per day, reviews per-leg travel time, stashes backups in **Saved**, lists restaurants to try, and seeds the journal/reading list. This is the heavy editing context.
2. **On the ground while traveling (often weak or no signal).** Opening an **active** trip (today within its dates) auto-lands the Plan/Days view on today's date with a prominent next-stop card and an "Open in Google Maps" hand-off. The user reads the day's plan, opens native maps to navigate, logs actual spend, and jots journal notes — and everything except the in-app Google map and editing works with no signal.

### 1.4 Key product principle

**Reliability and offline-readability over feature breadth.** The competitive scan flagged Stippl as a cautionary tale — crashes and sync bugs eroded trust. BurgerGo deliberately trades breadth for dependability: a small, polished feature set that *always opens and always shows your plan*. The two choices that enforce this are **read-only offline** (no offline editing → no sync-conflict surface) and **hard-cached Google data** (place details + directions in SQLite, shown offline). When in doubt, BurgerGo does fewer things and does them without breaking.

### 1.5 Primary goals

1. **Trustworthy offline reading.** Full app shell plus *all* trip data — itineraries, places, restaurants, expenses, journal, saved links, uploaded photos — readable with zero connectivity.
2. **Fast on-the-ground execution.** Active trips open straight to today's next-stop card with one-tap "Open in Google Maps."
3. **Frictionless planning.** Add places via Google Places Autocomplete (session-tokened) or a long-press map pin; reorder by drag; promote a Saved place to a day in one tap.
4. **One coherent trip workspace.** Plan / Eats / Budget / Journal tabs cover itinerary, restaurants, actual spending, and journaling/reading without leaving the trip.
5. **Cost-controlled Google usage.** Cache place details and directions hard, use Autocomplete session tokens, minimize JS map loads — a single user's API cost stays negligible.
6. **Bilingual, on-brand, mobile-first.** A warm, rounded, cute-but-clean UI that toggles EN ⇄ 中文 and is comfortable one-handed.
7. **Self-hostable and durable.** Dockerized app + SQLite volume + uploads volume, with simple documented backup.

### 1.6 Explicit non-goals (v1)

| Non-goal | Why it is excluded |
|---|---|
| **Multi-user / accounts / sharing** | App is private and single-user; no auth, no roles, no collaboration. |
| **Offline editing** | Read-only offline is deliberate — eliminates the sync-conflict bugs that sank Stippl. Editing requires connectivity. |
| **Turn-by-turn navigation** | We hand off to Google Maps via deep-links; BurgerGo never builds its own routing/voice nav. |
| **Bill-splitting / shared expenses** | Single user logs their own actual spend; no payees or settlement. |
| **Planned budget in v1** | Only *actual* spend is logged. The data model is architected so a planned budget can be added later without rework. |
| **Multi-currency per expense** | One global currency, set in Settings, applies app-wide. |
| **Non-Google maps/providers** | Maps and places are Google-only (Maps JS API, Places, Directions, Geocoding). |

### 1.7 Success criteria (measurable)

| # | Criterion | Target |
|---|---|---|
| S1 | **Offline completeness** — with the network disabled after a trip has loaded once online, every non-map screen and all uploaded photos render fully. | 100% of trip data + photos readable offline; 0 missing-data errors. |
| S2 | **Cold offline open** — launching the installed PWA with no signal opens the app shell and last-viewed trip. | App shell interactive in < 2 s on a mid-range phone; no crash/blank screen. |
| S3 | **Today-landing** — opening an active trip lands on today's date with the next-stop card and "Open in Google Maps" present. | Correct on 100% of active-trip opens. |
| S4 | **Add-place speed** — from "add place" to a saved place on a day. | ≤ 3 taps for Autocomplete; ≤ 2 taps to drop a pin; ≤ 1 tap to promote a Saved place. |
| S5 | **Directions cache hit** — per-leg travel times recompute *only* when a day's stops change; otherwise the cached `travel_legs` value is served (incl. offline). | 0 Directions API calls when stops are unchanged. |
| S6 | **Autocomplete session-token discipline** — each search-to-selection uses exactly one session token. | 100% of Places sessions tokened. |
| S7 | **Reliability** — no crashes or data-loss across plan/edit/offline-read cycles. | 0 crashes / 0 lost writes in acceptance testing. |
| S8 | **Bilingual coverage** — every UI string resolves in both EN and 中文 with no missing-key fallbacks. | 100% i18n key coverage; 0 untranslated strings. |
| S9 | **Self-host bring-up** — a fresh `docker compose up` yields a working app over localhost/HTTPS, with PWA install + geolocation functioning and a documented SQLite backup path. | Clean bring-up from documented steps with no manual code edits. |

---

## 2. Information Architecture & Navigation

BurgerGo has two shells and a single home-level Settings screen. There is no auth layer (open app on a private server), which keeps routing, middleware, and caching simple.

```
/                         Home — trips list (cover cards) + New Trip + Settings gear
/settings                 App-global settings (language, currency) — reached from Home only
/trip/[tripId]            Trip shell → redirects to today (active) or Day 1 (otherwise)
/trip/[tripId]/plan       PLAN — ?view=list|map & ?bucket=days|saved & ?date=YYYY-MM-DD
/trip/[tripId]/eats       EATS — restaurants
/trip/[tripId]/budget     BUDGET — expenses + breakdown
/trip/[tripId]/journal    JOURNAL — entries + saved-links reading list
```

- **Home** is the trips list plus a New Trip affordance and the Settings gear. Settings is **app-global and single-user** (the `settings` entity: `language`, `currency`); it is *not* inside a trip.
- **Inside a trip**, a fixed **bottom tab bar** offers four tabs — **Plan · Eats · Budget · Journal**. The trip shell (header + tab bar) is persistent; tab pages render above it.
- **"Today" is not a tab.** Opening an **active** trip (today within `start_date`…`end_date`, computed in the container `TZ`) redirects to `/trip/[tripId]/plan?view=list&bucket=days&date=<today>`, landing on today's Plan/Days view with a prominent next-stop card. A non-active trip redirects to `…?view=list&bucket=days&date=<start_date>` (the explicit Day 1 date keeps the cached URL stable; never a bare `/plan`).
- **Plan view state lives entirely in the URL** (`view`, `bucket`, `date`) — not React state — so deep links survive refresh and each permutation is independently offline-cacheable.

**Tab bar visibility:** the bottom tab bar is hidden on **Home**. Inside a trip it is **always visible**, including in **Map** view — the Map is *not* full-screen; it renders within the trip shell with the List/Map and Days/Saved toggles pinned on top and the tab bar below.

---

## 3. Screens — Home, Plan, Map & Today

Everything here is mobile-first, single-user, and offline-readable. Write actions disable gracefully with no signal (see the standardized offline copy in §3.7). Palette: Coral `#EE5B3C` (primary action), Teal `#4F8A86` (info/secondary), Ink `#6E5544` (text), Paper `#F5EEE1` (app bg), Card `#FBF7EF` (surfaces), Sun `#F2C879` (highlight). Cards use 16px radius, soft shadows, generous spacing.

### 3.1 Home — Trips List

The app root (`/`) is the trips list: a single scrollable column of trip cover cards on a Paper background.

**Layout**
- Top bar: BurgerGo wordmark left; a Settings gear (Ink) right → `/settings`.
- Trip cards (full-width, 16px radius, soft shadow), each showing:
  - Cover image. If no `cover_photo`, render the **Sun→Coral cover gradient** `linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)` with the trip name overlaid. (This is the single canonical cover gradient; "peach→coral" elsewhere refers to this Sun→Coral stop pair.)
  - Trip `name` (Ink, bold).
  - Date range `start_date – end_date` + derived day count (e.g. "May 3 – May 9 · 7 days").
  - A status pill: **Upcoming** (Sun), **Active** (Coral) when today is within the date range, or **Past** (Teal, muted). The Active card sorts to the top.
- A persistent **New Trip** affordance: a Coral floating "+" button bottom-right, mirrored as a dashed "＋ New trip" card at the top of an empty/short list.

**New Trip flow** — a bottom sheet (keeps it light):
- Fields: `name`, `start_date`, `end_date` (native date pickers; end ≥ start enforced inline). Cover is optional here (added later from inside the trip).
- On save: insert Trip, derive Days across the range, route into the trip's Plan tab — to **today** if Active, else **Day 1** (`date=<start_date>`).

**Rename & cover** — long-press (or a "⋯" overflow) opens an action sheet: **Rename**, **Change cover**, **Delete trip** (destructive `--danger`, requires confirm). Change cover opens the phone photo picker → server-side resize → uploads volume → cached for offline. Cover and name are also editable from the trip header.

**Empty state** — first launch shows the mascot centered, headline "Where to first?", subtext "Plan your first trip and BurgerGo will tag along.", and a Coral **New Trip** button.

**Offline** — all trip cards, covers, and data render from cache. New Trip and overflow edit actions are visibly disabled with the standardized offline tooltip (§3.7).

### 3.2 Trip Shell & Bottom Tabs

Entering a trip routes through `/trip/[tripId]` (redirect logic) into `/trip/[tripId]/plan`. Inside any trip:
- **Header:** back chevron → Home, trip `name` (tap to rename), date-range subtitle.
- **Bottom tab bar** (fixed, 4 tabs, Ink icons, Coral active state): **Plan · Eats · Budget · Journal**. "Today" is *not* a tab — it is a landing behavior of Plan/Days.

### 3.3 Plan Tab — Toggles & Structure

Route: `/trip/[tripId]/plan`. Two independent toggles pinned in a sticky sub-header:

- **Top-left: List ⇄ Map** — switches the rendering of the current bucket between a scrollable list and the Google map.
- **Top-right: Days ⇄ Saved** — switches the data bucket between the day itinerary (`day_date` set) and the wishlist (`day_date = NULL`).

State is in the URL so it survives refresh, is deep-linkable, and is independently offline-cacheable:

```
/trip/[tripId]/plan?view=list|map&bucket=days|saved&date=YYYY-MM-DD
```

The four combinations: **List+Days** (day itinerary), **List+Saved** (wishlist list), **Map+Days** (routed map), **Map+Saved** (un-routed wishlist pins). Toggles are segmented controls (Card track, Coral selected thumb), sized for thumb taps.

### 3.4 Plan · Days — Day Itinerary (List)

The default and most-used screen: a vertical timeline of the trip's auto-generated calendar days.

**Day navigation** — a horizontal, swipeable **day strip** under the toggles: chips reading "Day 1 · Mon May 3", "Day 2 · Tue May 4"… Selected chip is Coral; today's chip carries a Sun dot. Swiping the content area left/right also moves between days, updating `date` in the URL.

**Within a day** — an ordered list of Place cards (sorted by `order_index`):
- A **numbered pin** badge on the left in the day's assigned color, connected by a vertical Teal trail line. The **pin label = `order_index + 1`** (pins read 1, 2, 3…).
- Place `name` (Ink bold), `category` icon (sightseeing / lodging / transport / activity / other), `address` (muted).
- Optional meta row: `scheduled_time`, `duration` (rendered as minutes, sourced from `duration_min`), `cost` (single currency) when set.
- Thumbnail of the first photo if present.

**Per-leg travel time** — between consecutive Place cards, a slim **leg connector** shows mode + duration + distance from the `travel_legs` cache, e.g. "🚶 12 min · 0.9 km." Values come from the Directions cache and **recompute only when the day's stops change**; the cached value displays offline. **Travel mode is chosen per day** (a single day-level walk/drive/transit control) — see §3.4.1. A "recompute" affordance appears only online and may only refetch the current adjacencies (it cannot bypass the cache-hard rule). When a leg is uncomputed/unavailable offline, it shows the canonical placeholder **`—`** with the caption "needs connection" (no spinner).

#### 3.4.1 Travel mode (per-day, with optional per-leg override)

To keep the cost-control story intact, **the day's travel mode is a single per-day setting** (walk / drive / transit) shown in the day header. Changing it computes/serves legs for that mode for the whole day. An **optional per-leg override** is available but only fetches and caches on **explicit user action while online**; each `(from_place_id, to_place_id, mode)` is a distinct cached row in `travel_legs`. Offline, mode controls are disabled and the last cached mode's values render.

**Gestures & interactions**
- **Drag-to-reorder:** long-press a card lifts it; reordering rewrites `order_index` and invalidates affected `travel_legs` rows (recomputed when online). Drag is disabled offline.
- Tap a card → Place detail (full photos, notes, cost, "Open in Google Maps").
- Swipe a card left → quick actions: **Move to Saved** (sets `day_date = NULL`), **Move to another day**, **Delete**.

**Add-place flows** — a Coral "＋ Add place" button per day opens a bottom sheet with two paths:
1. **Search (Autocomplete)** — Google Places Autocomplete; one **session token** spans keystrokes-through-selection of a single add. Selecting a prediction calls Place Details → auto-fills `name`, `address`, `lat/lng`, `google_place_id`, photo, `category`, caches the place, and appends it with the next `order_index`.
2. **Drop a pin on the map** — switches the sheet to a mini Google map; **long-press drops a pin**, reverse-geocode fills `address`/coords, the user confirms name/category, and it's appended. Map-drop pins are saved as Place rows with **`google_place_id = NULL`** (no `place_details_cache` row is created for them).

A secondary path **"Add from Saved"** opens the wishlist for one-tap promotion (§3.5).

**Empty state (day with no stops)** — mascot in a "resting on backpack" pose, "Nothing planned for Day 3 yet", a Coral **＋ Add place** button, and an "Add from Saved" link.

### 3.5 Plan · Saved — Wishlist Bucket (List)

Places with `day_date = NULL`, not tied to any date.

**Layout** — a simple card list (no numbered pins, no travel legs, no day ordering). Each card shows `name`, `category` icon, `address`, optional photo and `notes`. Optional lightweight category filter chips along the top (filter chips are convenience polish, not a locked requirement).

**One-tap promotion** — each Saved card carries a Coral **"Add to day →"** button. Tapping it opens a compact day picker; choosing a day sets `day_date` and assigns the next `order_index` on that day in a single tap — the place leaves Saved and appears at the bottom of that day's itinerary. (Reverse: a Days card's "Move to Saved" sets `day_date = NULL`.)

**Add to Saved** — the same two add-place flows as Days, but the new place is created with `day_date = NULL`.

**Empty state** — mascot "sniffing a map pin", "No saved spots yet", subtext "Stash places you might want — promote them to a day later.", and **＋ Add place**.

### 3.6 Plan · Map — Trip Map View

Toggling **Map** renders the Google Maps JavaScript API (online only). Respects the Days/Saved bucket. The trip shell and bottom tab bar remain visible (Map is not full-screen).

**Map+Days**
- Renders all trip pins. Each day's stops use that **day's assigned color and numbered icons** (label = `order_index + 1`); consecutive stops are joined by an **ordered route polyline** in the same color.
- A **per-day visibility filter** (horizontal legend chips per day color, plus "All days") toggles each day's pins + polyline.
- Tapping a pin opens a compact info card: `name`, `category`, thumbnail, **"Open in Google Maps"** (deep-link hand-off). A day-level **"Open day route in Google Maps"** action builds a multi-stop directions deep-link for the selected day.

**Map+Saved** — wishlist pins (un-routed, no polylines); same info card + **"Open in Google Maps"** and an **"Add to day →"** promotion action.

**Map controls** — recenter-to-trip button; toggles stay pinned on top. JS map loads only on Map view to control cost.

**Offline** — the in-app Google map cannot load without signal. Offline, Map view shows a Teal banner with the mascot — "Map needs a connection. Tap any place to open Google Maps." — while the underlying place list and every **"Open in Google Maps"** deep-link remain available (the native app handles its own offline maps).

### 3.7 Standardized offline copy

One banner and one tooltip, both bilingual, used everywhere:

- **Offline banner** (slim Teal `#4F8A86` strip): **"Offline — viewing saved data. Editing needs a connection."** / **「离线 — 正在查看已保存的数据，编辑需要联网。」**
- **Disabled-control tooltip/toast:** **"Connect to the internet to make changes."** / **「请联网后再进行更改。」**

Floating "+" FABs and all mutating affordances render visibly disabled (reduced opacity, no Coral) while `navigator.onLine === false`.

### 3.8 Today — Auto-Land Behavior

Opening an **Active** trip routes to `…/plan?view=list&bucket=days&date=<today>` — the Plan/Days view pre-scrolled to today's date chip. "Today" is computed in the container `TZ` on both the server redirect and the client day strip.

**Next-stop card** — pinned at the top of today's itinerary, styled in Coral as the hero element:
- Label "Up next", the next stop's `name`, `scheduled_time` if set, `category` icon, and the travel leg to it (from the `travel_legs` cache).
- A large **"Open in Google Maps"** button (deep-link).
- An inline **"Skip / Next stop"** control to advance to the following stop.

**"Next stop" is a transient, client-only pointer — it does not persist.** There is **no `passed`/`skipped` field** in the schema (consistent with read-only offline). Default selection = the first stop whose `scheduled_time` is still in the future; if no stop has a time, it defaults to stop 0 (`order_index = 0`). "Skip / Next" advances the pointer locally and **resets on reload**. This is a deliberate, minimal Roadtrippers-style convenience, explicitly scoped as non-persistent.

If today has no stops, the next-stop card is replaced by the mascot empty state with **＋ Add place** / **Add from Saved**. Non-active trips open on **Day 1** (`date=<start_date>`) with no next-stop card. The Today hero renders fully from cache; only "Open in Google Maps" requires the native app.

---

## 4. Screens — Eats, Budget, Journal & Settings

Three tabs live on the in-trip bottom bar (**Eats · Budget · Journal**); **Settings** is reached from Home at `/settings`. All follow the "Sunset Wanderer" system and are fully readable offline; any editing control is disabled offline with the standardized notice (§3.7). The shared offline banner and greyed FABs apply throughout.

### 4.1 Eats — `/trip/[tripId]/eats`

Restaurants are their **own per-trip entity** (not Places). A single scrollable list of restaurant cards.

**Top bar.** Title "Eats" (中文: "美食"). Below it, a segmented **status filter** `All · Want to try · Been` mapping to `status` (`want-to-try | been`). A secondary sort control cycles `Recently added · Rating · Cuisine` (sort is optional polish, not locked scope).

**Restaurant card.**

| Element | Source field |
|---|---|
| Name (bold, Ink) | `name` (free-text, any language) |
| Cuisine chip (Teal outline) | `cuisine` |
| Status pill | `status` — "Want to try" (Sun-tint) / "Been" (`--success`-tint, check) |
| Rating | `rating` (1–5) — coral-tinted stars; **shown only when a rating exists** (`NULL`/0 = unrated) |
| Price level | `price_level` (1–4) — rendered `$`–`$$$$`; `$` (1) is the minimum, no free/0 |
| Notes preview (1–2 lines, muted) | `notes` |
| Schedule indicator | shown if linked to a place/day (see below) |

Tapping a card opens the **restaurant detail sheet** (bottom sheet, ~90% height): all fields editable inline, a "Mark as Been / Want to try" toggle, and a Coral **Delete** behind a confirm.

**Add / edit a restaurant.** Coral "+" FAB opens the **Add restaurant** sheet: Name (required), Cuisine (free-text; recent-cuisine suggestions are optional polish), Status (default `want-to-try`), Price level (`$`–`$$$$` selector, optional), Rating (optional, typically set after a visit), Notes. Eats is *not* driven by Google Places search; that lives in Plan.

**Schedule onto a day (restaurant → Place lifecycle, locked).** From the detail sheet, "Add to itinerary" opens a compact picker (pick a day; optional `scheduled_time`). Confirming:
- **Creates a Place** on that day with **`category = other`** (the single canonical default), name/notes **copied once at creation** from the restaurant.
- Records the link via `restaurants.linked_place_id` (FK → `places.id`, `onDelete: set null`).
- The card shows a "Scheduled · Day 3 (Wed)" indicator; the restaurant then appears as a numbered stop in Plan → Days and participates in per-leg travel recompute and the Today next-stop pointer like any other Place.

Lifecycle rules:
- **Renaming the restaurant does NOT re-sync the created Place** (name/notes are copied once, not live-bound).
- **Deleting the created Place** sets `linked_place_id = NULL` (un-schedules the restaurant); the card returns to "unscheduled." This is surfaced in the UI as the schedule indicator clearing — not a silent change.
- **Un-scheduling** from the restaurant sheet clears the link and removes the Place.

**Empty state.** Mascot + "No restaurants yet" / "还没有餐厅" + "Track places you want to try and rate the ones you've been." + Coral "Add restaurant." The empty `Been` filter reads "Nothing tried yet — go eat!"

### 4.2 Budget — `/trip/[tripId]/budget`

Logs **actual spend only** (no planned budget in v1) in the **single global currency** from Settings.

**Top summary block.** A Card with a Sun→Coral gradient header showing the **trip total** (large). Below it, a **breakdown by category** — a horizontal stacked bar plus a legend listing each `category` (food · lodging · transport · activities · shopping · other) with its sum and % of total. A toggle switches between **By category** and **By day** (day totals across the trip's calendar dates).

**Expense list.** Grouped by **`spent_on` date** (descending), each group headed by its calendar date + weekday. Each row:

| Element | Source field |
|---|---|
| Category icon + label | `category` (color-coded) |
| Amount (right-aligned, bold, tabular) | `amount` (minor units) + currency symbol |
| Note (muted, 1 line) | `note` |
| Linked-place chip | `linked_place_id` → place name (Teal chip; tap jumps to that place in Plan) |

Rows swipe-left to edit/delete; tapping opens the **edit expense** sheet.

**Add expense.** Coral "+" FAB opens the sheet: **Amount** (numeric keypad, currency symbol prefixed) — required; **Category** (six-chip selector) — required; **Date** (`spent_on`, defaults to today; any date allowed); **Note** (optional); **Link to a place** (optional `linked_place_id`, picker over Days + Saved places; clearable). Amounts are stored as integer **minor units** and rendered using the currency's decimal exponent (§5).

> *Forward-compat note:* the schema and Budget UI must accommodate a future **planned budget** without rework — keep totals computed from a query and leave room in the summary block for a "spent vs. planned" treatment. Do **not** build planned budgets in v1.

**Empty state.** Mascot + "No expenses yet" / "还没有支出" + "Log what you spend as you go — see totals by category and by day." + Coral "Add expense." The summary block is hidden until the first expense exists.

### 4.3 Journal — `/trip/[tripId]/journal`

Two stacked sections under one tab: **Entries** and a **Reading list**. A top segmented control switches **Entries ⇄ Reading list**.

#### Entries (`journal_entries`)

A vertical feed of entry cards, newest first: `title`, optional `entry_date` (+ weekday), a `body` snippet, and a thumbnail strip if photos exist. Tapping opens the **entry reader** (full markdown render, photo gallery with full-screen tap-through, all images cached offline).

**Add / edit entry.** Coral "+" FAB → editor: **Title** (required); **Entry date** (`entry_date`, optional — defaults to today, clearable); **Body** (lightweight markdown editor: bold, italic, headings, lists, links; stored as markdown); **Photos** ("Add photo" captures/picks from phone; uploads resized server-side, stored on the uploads volume, cached offline; reorder by drag, remove with ✕); Save / Delete (Delete behind confirm).

#### Reading list (`saved_links`)

Each row: `thumbnail` (or a Sun-tinted mascot fallback tile), `title`, source domain, `note`. Tapping opens the URL; long-press / ⋯ offers Edit / Delete.

**Add-link flow.** Coral "+" → **Add link** sheet: **URL** (required); **Title** (editable); **Note** (optional). On paste, the app attempts a **server-side preview** (`POST /api/links/preview`, online only) to prefill `title` and download an OpenGraph image — **the fetched thumbnail is stored on the uploads volume and `saved_links.thumbnail` holds its path**, so it is offline-cacheable like other photos. If offline or the fetch fails, the user types the title and no thumbnail is stored. (This auto-fetch is an accepted addition beyond the bare `{url, title, note, thumbnail}` model; it requires the dedicated route handler in §8.)

**Empty states.** Entries: mascot + "No journal entries yet" / "还没有日记" + "Write about your day, add a few photos." + Coral "New entry." Reading list: mascot + "No saved links yet" / "还没有收藏链接" + "Save blogs and articles to read before your trip." + Coral "Add link."

### 4.4 Settings — `/settings`

Reached from **Home** (gear next to New Trip), not from inside a trip — these are **app-global** (`settings`: `language`, `currency`). Plain grouped-list layout on Paper.

**Language.** A segmented toggle **English ⇄ 中文** bound to next-intl. Switching re-renders the whole UI immediately and persists `settings.language` + the locale cookie. User-entered content is never translated.

**Currency.** A single **global currency** selector (searchable; stores an ISO-4217 code in `settings.currency`). A one-line note clarifies it controls **display formatting only** and does **not** convert existing amounts — all Budget figures are recorded and shown in this one currency. The renderer maps the ISO code to a decimal exponent (JPY=0, USD/CNY=2, KWD=3) to convert stored minor units to a major-unit display.

**About.** Mascot + "BurgerGo" wordmark, a one-line tagline ("Your personal travel companion" / "你的私人旅行伙伴"), and app version. Two quiet info rows:
- **Offline & install** — BurgerGo works offline for **reading** saved trips; **installing the app and using your location require HTTPS** (or localhost).
- **Your data** — all data lives in the user's own SQLite database on their server; pointer to backup guidance.

**Onboarding flag.** First-run onboarding (§9.6) is shown once. Because the `settings` entity holds only `{language, currency}`, the **onboarding-completed flag is stored in `localStorage`** (key `burgergo.onboarded`), not in the DB — it is a device-local UI preference and need not survive a DB restore.

**Offline behavior.** Settings remain **viewable** offline; Language and Currency controls are disabled with the standardized tooltip, since both write to the database. The `/settings` route is offline-cacheable like trip-data routes.

**Empty/first-run.** On first launch (no trips; `language` defaults to device locale if EN or ZH else English; `currency` defaults to a sensible value the user confirms), the About block doubles as a gentle welcome with a "Create your first trip" link.

---

## 5. Data Model & Drizzle Schema

BurgerGo persists everything in a single SQLite file (Drizzle ORM + better-sqlite3), owned by one user. There is **no `user` table** and no `user_id` anywhere. Because offline is **read-only**, the schema carries **no sync metadata** (no dirty flags, tombstones, or vector clocks); the service worker caches what the server already wrote.

### 5.1 Conventions

- **IDs:** text primary keys generated app-side as UUIDs (`text('id').primaryKey()`). Stable across export/backup. (The `settings` table is the one exception — a fixed integer `id = 1`.)
- **Timestamps:** `created_at` / `updated_at` as Unix epoch integers (`integer({ mode: 'timestamp' })`).
- **Dates** (`start_date`, `end_date`, `day_date`, `spent_on`, `entry_date`): `TEXT` ISO `YYYY-MM-DD` — timezone-free calendar dates that sort lexicographically.
- **Money:** integer **minor units** (e.g. cents) in a single global currency, never floats. Rendering applies a per-ISO-currency **decimal exponent** (JPY=0, USD/CNY=2, KWD=3) so minor units convert to a correct major-unit display. next-intl handles symbol/grouping; the exponent map handles the minor→major conversion.
- **Enums:** `text({ enum: [...] })`.
- **Cascades:** every child table references `trips.id` with `onDelete: 'cascade'`. `linked_place_id` references use `onDelete: 'set null'`.

### 5.2 Tables

**`trips`**

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | UUID |
| name | text | no | renameable |
| start_date | text (YYYY-MM-DD) | no | Day 1 anchor |
| end_date | text (YYYY-MM-DD) | no | must be ≥ start_date (app-validated) |
| cover_photo | text | yes | photos path reference |
| created_at / updated_at | integer ts | no | |

**`places`** — central itinerary/wishlist entity.

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| day_date | text (YYYY-MM-DD) | **yes** | **NULL = Saved/wishlist bucket** (this is the locked `day_id`) |
| google_place_id | text | yes | for Place Details cache + dedupe; **NULL for map-drop pins** |
| name | text | no | |
| address | text | yes | |
| lat | real | yes | |
| lng | real | yes | |
| category | text enum | no | `sightseeing \| lodging \| transport \| activity \| other` |
| scheduled_time | text (HH:MM) | yes | |
| duration_min | integer | yes | minutes; UI label is "duration" |
| cost | integer | yes | minor units, single currency |
| notes | text | yes | |
| order_index | integer | no | 0-based contiguous; pin label = `order_index + 1` |
| created_at / updated_at | integer ts | no | |

Indexes: `idx_places_trip_day (trip_id, day_date, order_index)`; `idx_places_google (google_place_id)`.

**`restaurants`** — own entity per trip.

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| name | text | no | |
| cuisine | text | yes | free text |
| rating | integer | yes | 1–5; NULL = unrated |
| status | text enum | no | `want-to-try \| been` |
| price_level | integer | yes | 1–4 ($–$$$$); 1 is minimum |
| notes | text | yes | |
| linked_place_id | text FK→places.id | yes | optional schedule link; `onDelete: 'set null'` |
| created_at / updated_at | integer ts | no | |

Index: `idx_restaurants_trip (trip_id, status)`.

**`travel_legs`** — the Directions cache.

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| from_place_id | text FK→places.id | no | cascade |
| to_place_id | text FK→places.id | no | cascade |
| mode | text enum | no | `walk \| drive \| transit` |
| duration_seconds | integer | no | |
| distance_meters | integer | no | |
| computed_at | integer ts | no | |

Unique index: `uniq_leg (from_place_id, to_place_id, mode)` — one cached value per ordered pair per mode.

**`expenses`**

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| amount | integer | no | minor units, **actual** spend |
| category | text enum | no | `food \| lodging \| transport \| activities \| shopping \| other` |
| spent_on | text (YYYY-MM-DD) | no | enables by-day breakdown |
| note | text | yes | |
| linked_place_id | text FK→places.id | yes | `onDelete: 'set null'` |
| created_at / updated_at | integer ts | no | |

Indexes: `idx_expenses_trip_date (trip_id, spent_on)`, `idx_expenses_trip_cat (trip_id, category)`.

**`journal_entries`**

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| title | text | yes | |
| body | text | no | markdown |
| entry_date | text (YYYY-MM-DD) | yes | optional |
| created_at / updated_at | integer ts | no | |

**`saved_links`** — Journal reading list.

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | |
| trip_id | text FK→trips.id | no | cascade |
| url | text | no | |
| title | text | yes | |
| note | text | yes | |
| thumbnail | text | yes | **path reference** (downloaded OG image on uploads volume) |
| created_at / updated_at | integer ts | no | |

**`photos`** — normalized photo references for **personal uploads only** (places + journal entries). One row per uploaded image.

| Column | Type | Null | Notes |
|---|---|---|---|
| id | text PK | no | photoId |
| trip_id | text FK→trips.id | no | cascade |
| owner_type | text enum | no | `place \| journal` |
| owner_id | text | no | `places.id` or `journal_entries.id` |
| path | text | no | **base path** `<tripId>/<photoId>` (no extension); see §5.6 |
| width / height | integer | yes | of the `full` derivative, for layout |
| order_index | integer | no | gallery order |
| created_at | integer ts | no | |

Index: `idx_photos_owner (owner_type, owner_id, order_index)`.

**`place_details_cache`** — Google Place Details cache, shared across all trips (canonical schema table; the offline path depends on it).

| Column | Type | Null | Notes |
|---|---|---|---|
| google_place_id | text PK | no | cache key |
| name | text | yes | |
| address | text | yes | |
| lat / lng | real | yes | |
| category_guess | text | yes | mapped from Google `types` → our enum |
| photo_ref | text | yes | Google photo reference |
| photo_local_path | text | yes | downloaded copy on uploads volume (`place-photos/<google_place_id>`) |
| raw_json | text | yes | full Details payload for future fields |
| fetched_at | integer ts | no | |

**`settings`** — single-row global config.

| Column | Type | Null | Notes |
|---|---|---|---|
| id | integer PK | no | always `1` |
| language | text enum | no | `en \| zh` |
| currency | text | no | ISO 4217, e.g. `USD`, `CNY` — the one global currency |

### 5.3 The `day_date`-null = wishlist pattern, and ordering

The locked model's nullable `day_id` is implemented as **`day_date`** because Days are *derived from trip dates rather than stored as rows*. Semantics are identical:

- `day_date = '2026-06-07'` → the place sits on that itinerary day.
- `day_date = NULL` → the place lives in the **Saved** bucket.

**Promoting a Saved place is one write:** set `day_date` to the target date and `order_index = max(order_index)+1` within that day. Demoting sets `day_date = NULL`. No cross-table move — exactly the one-tap promotion the spec requires.

**Ordering** is a per-bucket integer `order_index`. A "bucket" is one `(trip_id, day_date)` group (Saved = the `day_date IS NULL` group). Drag-to-reorder rewrites the affected rows' `order_index` as contiguous integers (0,1,2,…) — fractional indexing is unnecessary for one user. **Displayed pin number = `order_index + 1`.** The `(trip_id, day_date, order_index)` index keeps reads ordered for free.

### 5.4 Days: computed, not stored

A trip's days are fully determined by `start_date`/`end_date`: Day *n* = `start_date + (n-1)` days, weekday derived from that date, and a place belongs to a day purely via `day_date`. We **do not persist a `days` table**:

- The app expands `[start_date, end_date]` into an ordered date list in code, labels each "Day N · weekday · date", and buckets `places` by `day_date`.
- Editing trip dates is a pure metadata change. If the range **shrinks** below an existing `day_date`, the app surfaces those now-out-of-range places and offers to move them to Saved (`day_date = NULL`) — handled in app logic, **never silently deleted**, no schema churn.
- This keeps the offline cache thin: rendering the full itinerary needs only `trips` + `places`; day headers compute client-side (in the container `TZ` for "today" consistency).

### 5.5 `travel_legs` cache: keying & invalidation

Key = the **ordered pair plus mode**: `(from_place_id, to_place_id, mode)`, unique. Legs are **cached hard** — the cached `duration_seconds`/`distance_meters` render, including offline.

Recompute (call Directions) **only when stops change**:
- A consecutive pair appears with no cached row for the requested mode → fetch and insert.
- A place's `lat`/`lng` changes → delete legs where it is an endpoint; refetch lazily.
- A place is deleted → `onDelete: 'cascade'` removes its legs.
- Reordering changes which pairs are consecutive; new adjacencies fetch on demand, stale rows are ignored and can be GC'd opportunistically by trip.

`computed_at` is informational (powers an "as of …" label and an optional online-only manual refresh that only refetches current adjacencies); it does **not** drive time-based expiry. The travel-mode toggle is per-day with optional explicit per-leg override (§3.4.1); each `(from, to, mode)` triple is a distinct row.

### 5.6 Photo storage: paths, not blobs

Photos are **files on the Docker uploads volume**; the DB holds only a **base path**. One `photos` row maps to **three generated size derivatives**:

- Base path stored in `photos.path` = `<tripId>/<photoId>` (no extension).
- The pipeline writes `<UPLOADS_DIR>/<tripId>/<photoId>/<size>.webp` for `size ∈ {thumb (~320px), card (~800px), full (~1600px max long-edge)}`.
- The serving route `GET /api/photos/[photoId]/[size]` resolves the file by appending `/<size>.webp` to the base path. Stable, content-addressed URLs let the service worker cache them for offline viewing.
- `cover_photo` and `saved_links.thumbnail` are likewise path strings.

**Google place photos do not become `photos` rows.** They live only in `place_details_cache.photo_local_path` (`place-photos/<google_place_id>/card.webp`). A Place card's "first photo" thumbnail resolves with this precedence: (1) the first personal `photos` row for that place (`owner_type = place`), else (2) the cached Google photo via `places.google_place_id → place_details_cache.photo_local_path`, else (3) the category-glyph placeholder. This gives every place card one canonical thumbnail source.

### 5.7 Single-currency settings, and room for a planned budget later

`settings.currency` is the one global currency; expenses store a raw integer `amount` with no per-row currency, so totals never need conversion. v1 logs **actual** spend only.

A **planned budget** can be added later with **no migration of existing data** — two additive, non-breaking options:
- A small `budget_targets` table keyed by `(trip_id, category)` with a `planned_amount` integer, leaving `expenses` as the actuals ledger; or
- Compute planned-vs-actual purely as a read-side view over `expenses`.

### 5.8 Drizzle schema sketch (design-level)

```ts
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),   // YYYY-MM-DD
  endDate: text('end_date').notNull(),
  coverPhoto: text('cover_photo'),           // relative path, nullable
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const places = sqliteTable('places', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  dayDate: text('day_date'),                 // NULL = Saved/wishlist bucket (locked day_id)
  googlePlaceId: text('google_place_id'),    // NULL for map-drop pins
  name: text('name').notNull(),
  address: text('address'),
  lat: real('lat'),
  lng: real('lng'),
  category: text('category', {
    enum: ['sightseeing', 'lodging', 'transport', 'activity', 'other'],
  }).notNull(),
  scheduledTime: text('scheduled_time'),     // HH:MM
  durationMin: integer('duration_min'),
  cost: integer('cost'),                      // minor units
  notes: text('notes'),
  orderIndex: integer('order_index').notNull(), // 0-based; pin label = orderIndex + 1
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  byTripDay: index('idx_places_trip_day').on(t.tripId, t.dayDate, t.orderIndex),
  byGoogle: index('idx_places_google').on(t.googlePlaceId),
}));

export const travelLegs = sqliteTable('travel_legs', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  fromPlaceId: text('from_place_id').notNull().references(() => places.id, { onDelete: 'cascade' }),
  toPlaceId: text('to_place_id').notNull().references(() => places.id, { onDelete: 'cascade' }),
  mode: text('mode', { enum: ['walk', 'drive', 'transit'] }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  uniqLeg: uniqueIndex('uniq_leg').on(t.fromPlaceId, t.toPlaceId, t.mode),
}));

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
  id: integer('id').primaryKey(),            // always 1
  language: text('language', { enum: ['en', 'zh'] }).notNull(),
  currency: text('currency').notNull(),      // ISO 4217, single global currency
});
// restaurants, expenses, journalEntries, savedLinks, photos follow the same shape
// as their tables above (FK → trips.id, onDelete: 'cascade'; linked_place_id onDelete: 'set null').
```

Drizzle `relations()` wire `trips → places / restaurants / expenses / journalEntries / savedLinks / travelLegs`, `places → travelLegs` (both endpoints) and `places → restaurants` (via `linked_place_id`), and the polymorphic `photos` join (resolved in app code by `owner_type`). Migrations are generated with drizzle-kit and applied at container start (§10.5) so the SQLite volume is always current before the app serves traffic.

---

## 6. Google Maps Integration & Cost Strategy

BurgerGo uses **Google Maps exclusively** for mapping, places, and routing, optimizing for two things: (1) **near-zero monthly cost** by caching every billable response in SQLite, and (2) **offline-readability** — once fetched online, a place's details and travel times remain visible with no signal. The interactive map is online-only; offline, the user hands off to the native Google Maps app via deep links.

### 6.1 APIs used and where each runs

| Capability | Google API | Runs | Trigger | Cached? |
|---|---|---|---|---|
| Interactive trip map (pins + polylines) | Maps JavaScript API | Client | Open PLAN → Map (online only) | No (JS render; minimize loads) |
| Place search | Places **Autocomplete** (JS, session tokens) | Client | Add-place search keystrokes | No (transient; session-token billed) |
| Place enrichment (name/address/coords/photo/category) | **Place Details** | **Server** proxy | User selects an autocomplete result | **Yes — `place_details_cache`** |
| Map long-press → address | **Geocoding (reverse)** | **Server** proxy | Long-press drops a pin | **Written into the Place row** (no cache row) |
| Per-leg travel time + distance | **Directions** | **Server** proxy | Consecutive day stops change | **Yes — `travel_legs`** |
| Open in native app | Google Maps Universal URLs | Client (just a URL) | Any place card / day-route button | N/A (no API call, no cost) |

**Rule:** every billable call except Autocomplete and the JS map render goes through a **server-side proxy** (`/api/google/*`). The server checks SQLite first, calls Google only on a miss, then writes the result back. The billing key stays server-only and the cache is the single source of truth for offline display.

### 6.2 Add-place flows and Autocomplete session tokens

1. **Autocomplete search.** The search box uses the Places JS library with a **single `AutocompleteSessionToken` per search session** — created on focus/first keystroke, passed on every prediction request, and **consumed by the matching Place Details call**, bundling a whole typing session + one Details fetch into one "Autocomplete (Per Session)" billing unit. A fresh token is minted after each selection (or on blur/reset).
2. **Map long-press drop.** A long-press captures `lat/lng`, then calls the server reverse-geocode proxy to resolve `address`. The resulting Place is saved with **`google_place_id = NULL`** and no `place_details_cache` row; the reverse-geocoded address is written straight into the Place row.

Autocomplete results converge on **Place Details**, which fills `name`, `address`, `lat`, `lng`, `google_place_id`, a downloaded photo, and a best-effort Google `types → category` mapping (user-correctable). The result is written to `place_details_cache` keyed by `google_place_id` so re-adding/re-viewing never re-bills.

### 6.3 Caching design (cost cut + offline)

**Place Details cache** — table `place_details_cache` (canonical schema in §5.2), keyed by `google_place_id`, shared across all trips.

Photos: when a place is saved, the referenced Google photo is **fetched once server-side, resized, and stored on the uploads volume** (`place-photos/<google_place_id>/card.webp`, recorded in `place_details_cache.photo_local_path`), then served by the app and precached by the service worker. The app never hot-links Google photo URLs at view time — avoiding repeated Photo billing and guaranteeing offline availability. (These are *not* `photos` rows; see §5.6 for the thumbnail precedence.)

**Directions / `travel_legs` cache:**
- Computed **only for consecutive stops within a day**, one leg per adjacent pair, for the day's mode (with optional explicit per-leg override).
- **Cached hard:** recomputed *only* when the stop sequence changes (add, remove, reorder, or coords change). Cached `duration_seconds`/`distance_meters` render between stops **offline**.
- Invalidation is structural, not time-based: editing a day's order marks affected legs stale; the server refetches just those pairs (online). No TTL, no background refresh.

Because editing requires connectivity, the cache is populated while online and only *read* while offline — there is no sync/conflict path.

### 6.4 "Open in Google Maps" deep-link formats

Every place and day route exposes **"Open in Google Maps"** via cross-platform Google Maps Universal URLs — opening the native app (with its own offline maps/navigation) on mobile, web as fallback. **We never build turn-by-turn.**

**Single place** — prefer `google_place_id`, fall back to coords:

```
# By place_id (exact POI; query is a human-readable label)
https://www.google.com/maps/search/?api=1&query=Senso-ji+Temple&query_place_id=ChIJ8T1GpMGOGGARDYGSgpooDWw

# By coordinates (used for map-drop pins lacking a place_id)
https://www.google.com/maps/search/?api=1&query=35.714765,139.796655
```

**Multi-stop day route** — origin = first stop, destination = last stop, intermediate stops as ordered `waypoints` (pipe-separated), with the day's travel mode:

```
https://www.google.com/maps/dir/?api=1
  &origin=35.6586,139.7454
  &destination=35.7148,139.7967
  &waypoints=35.6595,139.7005|35.6764,139.6993
  &travelmode=transit
```

**Enum → URL mode mapping (explicit, do not pass the internal enum raw):** `walk → walking`, `drive → driving`, `transit → transit`. Waypoints are encoded in `order_index` sequence; coordinates come straight from cached `places` rows, so the deep link is **constructible offline** even though tapping it requires the native app to fetch its own map. Google caps waypoints (~9 intermediate); a typical day is well under this, and each day's route is its own per-day button.

### 6.5 API key handling and restrictions

Two distinct keys, never interchanged:

| Key | Env var | Exposure | APIs enabled | Restriction |
|---|---|---|---|---|
| **Browser key** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Shipped to client | Maps JavaScript API, Places Autocomplete | **HTTP referrer** (deployment host) |
| **Server key** | `GOOGLE_MAPS_SERVER_KEY` | Server env only | Place Details, Geocoding, Directions, Photos | **IP address** (server egress IP) |

Both keys are **API-restricted** to only the APIs above. The server key lives only in container env/compose secrets; the browser key is inherently public but locked to referrer + a minimal API set, so a leak can't drive Directions/Details billing. Note: **PWA install and geolocation require HTTPS** (or localhost), supplied by the user's reverse-proxy/TLS — Maps JS and deep links work over plain HTTP/IP, but install/geolocation will not.

### 6.6 Realistic monthly cost estimate (one user)

Google bills these SKUs with a recurring **$200/month free credit**. For a single planner the credit covers everything with wide margin; out-of-credit pricing is shown only to illustrate the ceiling.

| SKU | Est. monthly volume (1 active planner) | Notes |
|---|---|---|
| Maps JS dynamic map loads | ~150–400 | Only on Map view; List view and offline load nothing |
| Autocomplete **(per session)** | ~50–150 sessions | One unit per search-to-selection (session tokens) |
| Place Details | ~50–150 | One per newly added place; **cache hit = $0** on re-view |
| Geocoding (reverse) | ~10–40 | Only on map long-press drops |
| Directions | ~50–200 | Only when a day's stop order changes; stable itineraries = $0 |
| Place Photos | ~50–150 (first-fetch only) | Downloaded once, then served locally |

**Bottom line:** a few hundred billable events/month — **effectively $0**, comfortably inside the free credit. Even pathological months stay an order of magnitude under the $200 credit.

### 6.7 Failure and fallback behavior

- **Offline (no signal).** The in-app map and all live lookups are unavailable by design; the app stays fully **readable** (itinerary, cached place details, cached photos, cached legs from SQLite). Map view shows the mascot offline state; every place/day-route still offers **"Open in Google Maps."** No edits are attempted offline.
- **Quota / billing limit hit (online).** Proxy routes detect Google error statuses (`OVER_QUERY_LIMIT`, `REQUEST_DENIED`, …) and **serve the last cached value** when one exists; on a true miss they return a soft error and a non-blocking toast ("Couldn't reach Google Maps — showing saved info") in Ink on Card with a Coral retry. Adding a brand-new place or computing a brand-new leg is the only thing that can fail outright, and it fails gracefully with a retry — never a crash.
- **Autocomplete error/empty.** Degrade to saving a place by map long-press / manual coords; a partial Place row (name + coords, no `google_place_id`) is valid and can be enriched later.
- **Directions failure for one leg.** Only that leg shows the canonical `—` placeholder ("needs connection" caption); the rest of the day and the day-route deep link remain fully functional.

---

## 7. Offline & PWA Strategy

BurgerGo's core promise is that one user's trip data stays fully **readable with no signal**. Offline is strictly **read-only**: app shell, all trip data, and all uploaded photos are cached so the traveler can browse everything on a plane or a dead-zone corner. Editing — and the in-app Google map — require connectivity.

### 7.1 Web App Manifest

`manifest.webmanifest` (referenced from the root layout `<head>`) drives install and standalone chrome. Icons under `public/icons/*` are generated at build from `public/burgergo-logo.png` (copied from the source `assets/burgergo-logo.png`).

```jsonc
{
  "name": "BurgerGo",
  "short_name": "BurgerGo",
  "description": "Your personal travel-planning assistant.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5EEE1",   // Paper — splash background
  "theme_color": "#EE5B3C",        // Coral — status/title bar tint
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

Notes: **maskable icons** place the cat + teal backpack in the safe zone on a Paper `#F5EEE1` field so Android adaptive shapes don't clip the mascot. iOS also gets `<link rel="apple-touch-icon">` and `<meta name="apple-mobile-web-app-capable" content="yes">` / status-bar-style. The bilingual UI keeps a single English manifest `name` (a proper noun); `lang` is cosmetic and not switched by the Settings toggle.

### 7.2 Service worker build tooling

The service worker is **built with Serwist** (the maintained Workbox successor for Next.js App Router) using `injectManifest`, so the build-hashed precache manifest is real. A custom source SW (`app/sw.ts`) is compiled and emitted to `public/sw.js` at build time with the precache list stamped in — this is what reconciles "static `public/sw.js`" with "build-stamped versioned precache." The SW is registered after first load from the root layout. Because there is no offline editing, the SW never needs Background Sync or a write queue — a deliberate simplification that sidesteps the sync-conflict class of bugs.

### 7.3 Offline read model & caching layers

**Offline reads cache JSON GET responses, not server-rendered HTML.** The app exposes read Route Handlers under `/api/trips/…` (defined in §8.2); pages fetch these endpoints and the SW caches the `Response` objects keyed by request URL. The same `fetch()` the UI makes transparently resolves from cache offline — no second data model, no mirror, no reconciliation.

| Layer | What | Storage | Strategy |
|---|---|---|---|
| App shell | JS/CSS/font/static chunks, manifest, icons, mascot art | Cache API (`burgergo-shell-v{buildId}`) | **Precache, cache-first** |
| Trip data (read API) | `GET /api/trips`, `/api/trips/:id`, `/api/trips/:id/places`, `/restaurants`, `/expenses`, `/journal`, `/links`, `GET /api/settings` | Cache API (`burgergo-data-v{n}`) | **Stale-while-revalidate** |
| Photos | Uploaded place + journal images + place/link thumbnails served by the app | Cache API (`burgergo-photos`) | **Cache-first**, immutable, quota-managed (see §7.4) |
| Google Maps JS / tiles / Directions / Places live calls / `/api/google/*` | In-app map, autocomplete, live lookups | **Never cached** (network-only) | online-only |

- **Stale-while-revalidate for data:** offline it serves the last cached JSON instantly; online it returns cache immediately and refreshes in the background, so re-opening after reconnect shows fresh data. **This is the single offline data strategy** — Risk 4 (§11) uses the same SWR strategy (not network-first).
- **App shell** is cache-first under a build-hashed name; **photos** are cache-first/immutable.
- We call `navigator.storage.persist()` on install so the browser is less likely to evict the trip cache under storage pressure — important for a phone carried offline for days.

### 7.4 Photo caching, warming & the "all photos offline" guarantee

Browsing a trip online naturally populates the data + photo caches. To make a trip **deliberately** offline-ready before departure, opening a trip triggers a lightweight prefetch that walks the trip's read endpoints and image URLs through the SW so every day, place, restaurant, expense, journal entry, saved link, and photo lands in cache. A per-trip **"Available offline"** indicator (with the mascot) confirms warming is complete.

**Photos cap, reconciled with the offline guarantee:** photos belonging to a trip the user has explicitly **warmed ("Available offline")** are **exempt from eviction** — they are pinned so a previously-offline trip's photos never silently disappear. Non-pinned, incidentally-cached photos may be trimmed under storage pressure (re-fetchable online). This preserves the locked "ALL uploaded photos readable offline" promise for any trip the user has prepared, while bounding storage for the rest.

### 7.5 How itinerary, travel times & map render offline

- **Itinerary (Plan ▸ Days):** Days derive from `start_date`/`end_date`, so date headers/weekdays compute client-side (container `TZ`) with zero network. Ordered `places` rows, numbered pins (`order_index + 1`), `scheduled_time`, `duration_min`, `cost`, `notes` come from cached trip-data JSON.
- **Per-leg travel time & distance:** `travel_legs` rows are served in the cached trip-data response — never recomputed live. Because Directions are cached hard, walk/drive/transit time + distance display offline straight from cache.
- **Place details:** name/address/coords/photo/category captured at add-time live in our DB, so place cards render fully offline.
- **Map (Plan ▸ Map):** online-only. Offline, the Map toggle shows the mascot placeholder ("Map needs a signal") while List stays fully functional. Every place/day route still exposes its **"Open in Google Maps"** deep-link — plain URLs requiring no in-app map load, handing off to the native app (its own offline maps). This is the offline navigation path.

### 7.6 Communicating offline state & disabling edits

- **Connectivity signal:** the standardized Teal offline banner (§3.7), driven by `navigator.onLine` + `online`/`offline` events. *(A captive-portal/no-internet heartbeat is deferred — see §11 scope notes — so no app-server ping endpoint is required by this feature; `navigator.onLine` is the v1 source of truth.)*
- **Edits disabled offline:** all mutating affordances — new trip, rename, add/promote place, drag-to-reorder, add restaurant/expense/journal/link, photo upload, in-app add-place search — render visibly disabled (reduced opacity, no Coral) with the standardized tooltip (§3.7).
- **Bucketed read access stays full:** Plan ▸ Days and Plan ▸ Saved, Eats, Budget totals/breakdowns, Journal entries + reading list are all browsable offline.
- A cache write only ever happens from a successful online response, so the user never sees a half-saved edit offline.

### 7.7 Install-to-homescreen flow

1. On a qualifying visit the browser fires `beforeinstallprompt`; we capture it and show a soft, dismissible **"Add BurgerGo to your home screen"** card (Coral CTA, mascot), remembering the choice so we don't nag.
2. **Install** calls `prompt()`; on accept the standalone icon is added and launches open in `standalone` with no browser chrome.
3. **iOS Safari** has no `beforeinstallprompt`; we detect iOS + non-standalone and show a one-time *Share ▸ Add to Home Screen* hint.
4. **HTTPS requirement:** install (and geolocation for map centering) require a **secure context** — HTTPS or `localhost`. The deploy docs call out that a TLS-terminating reverse proxy is required for install + location; plain-HTTP IP access works as a normal website but cannot install or geolocate.

### 7.8 Cache invalidation & versioning on deploy

- **Build-stamped precache:** the app shell is precached under `burgergo-shell-v{buildId}`; each Docker image deploy changes the build id, so the new SW precaches the new shell.
- **Lifecycle:** the new SW installs in the background; on `activate` it **deletes stale `burgergo-shell-*` / `burgergo-data-*` caches** that don't match the current build. We `skipWaiting()` + `clients.claim()` so the single user isn't stranded on an old shell, and surface a subtle **"Update ready — reload"** chip so reload happens at a safe moment.
- **Photos cache is content-addressed & long-lived:** hashed, immutable URLs let `burgergo-photos` survive across deploys (no re-download per release); pinned-trip photos persist, non-pinned ones are quota-managed.
- **Data freshness:** SWR means a deploy that changes API shape serves old JSON once, then self-heals on background revalidate; bump `burgergo-data-v{n}` on breaking response-schema changes to force a clean refetch.
- **Versioned API responses:** read endpoints send `ETag`/`Last-Modified` so revalidation is cheap (304s) when nothing changed.

---

## 8. Technical Architecture

A mobile-first, single-user PWA where trip data is fully **readable offline** and all mutations require connectivity. There is no auth layer, simplifying routing, middleware, and caching.

### 8.1 Next.js App Router structure

App Router with **route groups**; a per-locale URL segment is intentionally **avoided** — locale comes from a cookie, not the URL, so links and offline cache keys stay path-stable.

```
app/
  layout.tsx                  # root: <html>, fonts, Paper bg, NextIntlClientProvider, SW registration
  sw.ts                       # Serwist injectManifest source → compiled to public/sw.js
  (home)/
    layout.tsx                # home chrome (logo, Settings entry)
    page.tsx                  # trips list — cover cards + "new trip"
    settings/page.tsx         # /settings — language + currency (app-global)
  trip/
    [tripId]/
      layout.tsx              # TRIP SHELL: loads trip, renders bottom tab bar (Plan · Eats · Budget · Journal)
      page.tsx                # redirects: active → plan?date=<today>; else plan?date=<start_date>
      plan/page.tsx           # PLAN; reads ?view=list|map & ?bucket=days|saved & ?date=YYYY-MM-DD
      eats/page.tsx           # restaurants
      budget/page.tsx         # expenses + breakdown
      journal/page.tsx        # entries + saved-links reading list
  api/
    health/route.ts                         # GET — liveness + SQLite check
    trips/route.ts                          # GET list
    trips/[tripId]/route.ts                 # GET trip
    trips/[tripId]/{places,restaurants,expenses,journal,links}/route.ts  # GET reads
    settings/route.ts                       # GET settings
    google/{autocomplete,details,directions,geocode}/route.ts
    links/preview/route.ts                  # POST — OG/title fetch for saved links
    photos/route.ts                         # POST — multipart upload + resize
    photos/[photoId]/[size]/route.ts        # GET — serve resized image
  _actions/{trips,places,restaurants,expenses,journal,links,settings}.ts
```

**Trip shell** (`trip/[tripId]/layout.tsx`, server component): fetches the `Trip` once, renders the warm header and the persistent **bottom tab bar** (a small client component highlighting the active tab via `usePathname`; Coral active, Ink inactive); child pages render above it. Tabs are `<Link>`s so the shell never unmounts.

**"Today" behavior** is not a tab. `trip/[tripId]/page.tsx` compares **today (computed in the container `TZ`)** against `start_date`/`end_date`; active → redirect to `plan?view=list&bucket=days&date=<today>` (renders the next-stop card + "Open in Google Maps"); otherwise → `plan?view=list&bucket=days&date=<start_date>` (explicit Day 1, stable cache URL).

**Plan view state** (List⇄Map, Days⇄Saved, selected `date`) lives in **URL search params**, not React state — deep-linkable, offline-reload-stable, server-pre-renderable. Toggles `router.replace` the query string.

### 8.2 Reads, Server Actions, and Route Handlers

| Concern | Mechanism | Why |
|---|---|---|
| **Trip-data reads** (`GET /api/trips`, `/api/trips/:id`, `…/places`, `…/restaurants`, `…/expenses`, `…/journal`, `…/links`, `GET /api/settings`) | **Read Route Handlers** returning JSON, backed by the repo layer | These JSON GET endpoints are what the service worker caches for offline reads (§7.3). Pages fetch them; the SW caches the `Response` keyed by URL. |
| Create/rename trip, add/edit/reorder/promote place, restaurants, expenses, journal, saved links, settings | **Server Actions** (`app/_actions/*`) | Co-located, typed end-to-end, integrate with `revalidatePath`/`revalidateTag`. Single user → no public mutation REST surface needed. |
| Google Autocomplete proxy, Place Details, Directions, reverse-geocode | **Route Handlers** (`app/api/google/*`) | Keep the server key server-side; read/write the SQLite caches (`place_details_cache`, `travel_legs`). |
| Saved-link OG/title preview | **Route Handler** (`POST /api/links/preview`) | Server-side HTML fetch + OG parse + thumbnail download to the uploads volume. |
| Photo upload (multipart) | **Route Handler** (`app/api/photos/route.ts`) | Streams `multipart/form-data`, runs the resize pipeline, writes to the uploads volume. |
| Serving uploaded images | **Route Handler** (`app/api/photos/[photoId]/[size]`) | Returns the resized file with long-lived cache headers so the SW can cache it offline. |
| **Health** | **Route Handler** (`GET /api/health`) | Returns `200` and runs a trivial `SELECT 1` against SQLite; used by the compose healthcheck and upgrade verify. |

All mutation paths are guarded by an `online` check on the client (mutations disabled/greyed offline) and re-validated server-side; offline is strictly read-only by design.

### 8.3 Data-access layer over Drizzle

All DB access goes through a typed **repository layer** in `src/db/`; server components, read handlers, and Server Actions never touch Drizzle inline.

```
src/db/
  client.ts        # better-sqlite3 + drizzle() singleton (WAL mode; one connection, single-user)
  schema.ts        # trips, places, restaurants, travel_legs, expenses,
                   #          journal_entries, saved_links, photos, place_details_cache, settings
  repos/
    trips.ts       # getTrips, getTrip, createTrip, renameTrip; deriveDays(trip) → dates + weekday (TZ-aware)
    places.ts      # listByDay, listSaved, add, update, reorder, promoteToDay (sets day_date + order_index)
    restaurants.ts # by status (want-to-try | been), cuisine, rating; scheduleToDay/unschedule
    legs.ts        # getCachedLeg / upsertLeg (recompute only when stops change)
    expenses.ts    # log + totals byCategory / byDay
    journal.ts     # entries + photos
    links.ts       # saved reading list
    photos.ts      # personal uploads (place|journal); place-photo path resolution
    placeCache.ts  # place_details_cache read/write
    settings.ts    # language, currency (single global currency)
```

Key modeling decisions (consistent with §5): **Day is derived** — `deriveDays(trip)` computes calendar dates from `start_date`→`end_date` (Day 1 = start_date, weekday shown, container `TZ`); `places.day_date` is a nullable date string, `NULL` = Saved. **`travel_legs`** is a hard cache keyed `(from_place_id, to_place_id, mode)`. **Money** is integer minor units; currency is a single Setting; expenses log actuals only with room for a future `planned` addition. All child tables carry `trip_id` FKs; cascading deletes clean up a removed trip.

### 8.4 i18n with next-intl (cookie-driven locale)

Bilingual UI toggled in **Settings**, not by URL (no accounts; URLs stay path-stable for offline cache keys):
- Messages in `messages/en.json` and `messages/zh.json`.
- A `BURGERGO_LOCALE` cookie holds the choice; `i18n/request.ts` reads it (falling back to `settings.language`, then `en`).
- The Settings toggle is a Server Action that writes both the `settings.language` row and the cookie, then `revalidatePath('/', 'layout')` so the whole UI re-renders.
- Server components receive translations directly; client components use `useTranslations` under the root `NextIntlClientProvider`.
- **User-entered content is free-text and never translated.** Dates/numbers/currency format via next-intl `format` helpers against the active locale + the single currency setting; minor-unit→major conversion uses the ISO exponent map (§5).

### 8.5 Photo upload + server-side resize pipeline

Captured from the phone (`<input type="file" accept="image/*" capture>`), uploaded to `POST /api/photos`, resized with **sharp**, stored on the uploads volume — never in SQLite.
- **Sizes generated:** `thumb` (~320px), `card` (~800px), `full` (~1600px max long-edge), all progressive WebP, EXIF orientation applied, metadata stripped.
- **Storage:** `<UPLOADS_DIR>/<tripId>/<photoId>/<size>.webp`; the `photos` row stores base path `<tripId>/<photoId>` + owner (`place | journal`).
- **Serving:** `GET /api/photos/[photoId]/[size]` streams the file with immutable, long-lived `Cache-Control`; stable URLs let the SW cache them offline.
- Uploads (a mutation) are blocked offline.
- Google place photos follow the same resize pipeline into `place-photos/<google_place_id>/…` (recorded in `place_details_cache.photo_local_path`), not the `photos` table; saved-link OG thumbnails likewise download to the uploads volume with their path in `saved_links.thumbnail`.

### 8.6 Env / secrets handling

| Var | Purpose |
|---|---|
| `GOOGLE_MAPS_SERVER_KEY` | Server-only: Place Details, Directions, Geocoding, Photos. IP-restricted; never sent to client. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser key for Maps JS + Places Autocomplete; HTTP-referrer-restricted to the deployment origin. |
| `DATABASE_PATH` | SQLite file path on the volume. |
| `UPLOADS_DIR` | Resized-photo storage root. |
| `DEFAULT_CURRENCY`, `DEFAULT_LANGUAGE` | First-run seeds for the `settings` row. |
| `TZ` | Container timezone — drives consistent "today" on both server redirect and client day strip. |

Secrets are injected via docker-compose env / `.env` (git-ignored) and validated at boot by a small typed env module (`src/env.ts`) that fails fast if a required key is missing. Autocomplete **session tokens** are generated per search session to control Places cost; the map JS loads lazily (only on Plan ▸ Map) to minimize billed loads.

### 8.7 Client state & how offline reads work

Default: **server components + minimal client state**. Most screens render on the server from the repos via the read handlers; the client holds only ephemeral UI state — open sheets, drag-to-reorder, search input, the Map/List & Days/Saved toggles (mirrored to the URL), and the transient Today next-stop pointer (§3.8). No global client store is needed.

Offline-cached reads are delivered by the SW (§7): app shell precached cache-first; **trip-data JSON endpoints** (`/api/trips/…`, `/api/settings`) SWR-cached; photos cache-first/immutable; Google JS map and `/api/google/*` network-only. Cached `travel_legs` durations and place details still render offline because they come from the cached trip-data JSON, not a live Google call. A small `online`/`offline` listener flips the standardized banner and disables all mutation affordances, making the read-only-offline contract explicit.

### 8.8 Project folder layout sketch

```
burgergo/
  app/                       # routes, _actions, api, sw.ts (see §8.1)
  src/
    db/{client.ts, schema.ts, repos/*}
    google/{client.ts, sessionToken.ts, cache.ts}   # server Google wrappers + SQLite caching
    photos/pipeline.ts                                # sharp resize + storage
    currency.ts                                       # ISO 4217 → decimal-exponent map
    env.ts                                            # validated env/secrets
  components/{TripCard, BottomTabBar, PlanToggle, PlaceRow, MapView, EmptyState(mascot), OfflineBanner}
  i18n/request.ts
  messages/{en.json, zh.json}
  public/{manifest.webmanifest, sw.js, icons/, burgergo-logo.png}   # burgergo-logo.png copied from assets/
  assets/burgergo-logo.png                            # source original
  drizzle/                                             # drizzle-kit migrations (baked into image)
  scripts/migrate.ts                                  # programmatic migrate() at container start
  drizzle.config.ts
  Dockerfile  docker-compose.yml
```

This keeps the runtime small and reliable: server-rendered reads with a thin repo layer, mutations through typed Server Actions, reads exposed as cacheable JSON endpoints, Google calls funneled through cache-backed handlers, and a Serwist service worker that makes all trip data — text, budget, journal, photos — readable with no signal, while never permitting offline edits.

---

## 9. Visual Design System

This codifies BurgerGo's look into reusable tokens, components, and rules, tuned for a **mobile-first, single-user PWA** that must stay **readable offline** — so it relies only on self-hosted CSS, fonts, and SVG (no runtime style/icon CDNs), and every component has a clear offline-readable resting state. The north star is **"cute but clean"**: warm "Sunset Wanderer" palette, soft rounded cards, generous space, and the Siamese-cat mascot used sparingly. Coral drives action; everything else stays calm.

### 9.1 Palette tokens & roles

| Token | Hex | Role |
|---|---|---|
| Coral | `#EE5B3C` | **Primary action.** Buttons, active toggle, FAB, numbered place pins, selected tab, links. Mirrors the map pin. |
| Teal | `#4F8A86` | **Secondary / info.** Travel-time chips, per-leg lines, map route polylines (default), info badges, secondary buttons, offline banner. Mirrors trail/backpack. |
| Ink | `#6E5544` | **Primary text** (warm brown). Headings + body. |
| Paper | `#F5EEE1` | **App background.** |
| Card | `#FBF7EF` | **Card / surface** color. |
| Sun | `#F2C879` | **Highlight.** "Today" markers, want-to-try accents, gentle warnings, cover gradient stop. |

**Derived neutrals & states** (computed, not new brand colors):

| Token | Value | Use |
|---|---|---|
| `--ink-muted` | Ink @ 64% | Secondary text, metadata, weekday labels |
| `--ink-faint` | Ink @ 38% | Placeholders, disabled text |
| `--line` | Ink @ 12% | Hairline borders, separators |
| `--coral-press` | `#D94E30` | Pressed coral surfaces |
| `--coral-tint` | Coral @ 12% on Paper | Coral chip/badge bg, selected-day wash |
| `--teal-tint` | Teal @ 14% on Paper | Travel-time chip bg |
| `--sun-tint` | Sun @ 22% on Paper | "Today" wash, want-to-try chip |
| `--success` | `#3E8E6E` | "Been" status, saved confirmation |
| `--danger` | `#C2452E` | Destructive confirm (delete trip/place) |
| `--scrim` | Ink @ 45% | Bottom-sheet / modal backdrop |
| `--map-dim` | Paper @ 70% | Offline map placeholder overlay |

**Category colors** (`places.category` pins, chips, map filters — derived from the brand set):

| Category | Color basis | Glyph |
|---|---|---|
| sightseeing | Coral | camera / mountain |
| lodging | Teal | bed |
| transport | Ink-muted | bus / plane |
| activity | Sun (on Ink text) | ticket |
| other | Ink-faint | dot |

> Numbered itinerary pins are **always Coral** (with a per-day hue ring on the map); category color appears only on the row's small leading icon and in Saved/Map filters, so route order stays unambiguous. The pin number is **`order_index + 1`**.

### 9.2 Tailwind theme extension

Tokens live as CSS variables on `:root` (in `app/globals.css`) and are referenced by Tailwind.

```ts
theme: {
  extend: {
    colors: {
      coral:  { DEFAULT: '#EE5B3C', press: '#D94E30', tint: 'rgb(238 91 60 / 0.12)' },
      teal:   { DEFAULT: '#4F8A86', tint: 'rgb(79 138 134 / 0.14)' },
      ink:    { DEFAULT: '#6E5544', muted: 'rgb(110 85 68 / 0.64)', faint: 'rgb(110 85 68 / 0.38)' },
      paper:  '#F5EEE1',
      card:   '#FBF7EF',
      sun:    { DEFAULT: '#F2C879', tint: 'rgb(242 200 121 / 0.22)' },
      line:   'rgb(110 85 68 / 0.12)',
    },
    borderRadius: { card: '16px', sheet: '24px', chip: '999px', control: '12px' },
    boxShadow: {
      card:  '0 2px 8px rgb(110 85 68 / 0.08)',
      lift:  '0 8px 24px rgb(110 85 68 / 0.14)',   // dragged row, FAB, active sheet
      inset: 'inset 0 0 0 1px rgb(110 85 68 / 0.06)',
    },
    fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
  }
}
```

### 9.3 Typography

**Family.** One self-hosted variable sans for EN + Simplified Chinese to stay consistent and offline-safe: **Inter** (Latin) with **Noto Sans SC** (CJK) in the same `--font-sans` stack, bundled via `next/font` (no runtime Google Fonts fetch). Numbers use tabular figures (`font-variant-numeric: tabular-nums`) so budget totals and travel times align.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 34 | 700 | Trip cover title, onboarding headline |
| `title` | 22 / 28 | 700 | Screen titles (Plan, Eats, Budget, Journal) |
| `heading` | 18 / 24 | 600 | Day header date, section headers |
| `body` | 16 / 24 | 400 | Place names, journal body, primary content |
| `label` | 14 / 20 | 500 | Buttons, tabs, chips, metadata |
| `caption` | 13 / 18 | 500 | Travel-time, weekday, timestamps, helper text |
| `micro` | 11 / 14 | 600 | Pin numbers, badge counts (tabular) |

Chinese text drops uppercase tracking and uses weight 500 where Noto Sans SC's bolder forms feel heavy. Headings cap at 2 lines with ellipsis; free-text names wrap to 2 lines then truncate.

### 9.4 Radii, shadows, spacing rhythm

- **Radii:** cards & cover photos `16px` (`rounded-card`), sheets/modals `24px` top corners, pills/chips/toggles `full`, inputs/small controls `12px`. Numbered pins are perfect circles. Nothing sharp except hairline dividers.
- **Shadows:** soft, warm-tinted (Ink-based, never neutral gray). `shadow-card` resting; `shadow-lift` for FAB, dragged row, open sheet; `shadow-inset` hairline for chips on Paper.
- **Spacing:** 4px base grid; scale `4 / 8 / 12 / 16 / 24 / 32`. Screen gutters `16px`; card padding `16px`; gap between cards `12px`; section (day) gaps `24px`. Minimum tap target `44×44px`. Bottom content padding reserves `88px` so the tab bar + FAB never cover the last row.

### 9.5 Core components

**Trip cover card** (Home). Full-width rounded-card; 16:9 cover (`trips.cover_photo`) or the **Sun→Coral gradient** `linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)` with the mascot watermarked bottom-right at low opacity. Overlaid bottom-left: `display` trip name (white, soft Ink scrim) + `caption` date range "Jun 5 – Jun 12 · 8 days". An **active** trip (today ∈ dates, container `TZ`) shows a Sun "Today" chip top-right. Whole card taps into the trip.

**Place row** (Days). Left→right:
```
[① coral pin]  [cat-icon] Place name              [⋮ / drag]
 28px circle   leading   address · scheduled_time · cost
               category   teal travel-chip sits in the gap to next row
```
- The numbered pin is a Coral circle, `micro` white number = **`order_index + 1`**. Long-press anywhere engages **drag-to-reorder** (`shadow-lift`, neighbors reflow).
- Secondary line: truncated address, optional `scheduled_time`, `cost`; a small teal dot indicates `notes`.
- Trailing thumbnail (first personal photo, else cached Google photo, per §5.6) at `40px` rounded-control when present.

**Per-leg travel chip.** In the 12px gap between rows, under the pin column: a teal-tint pill `🚶 12 min · 0.9 km` (mode icon per the day's mode). Renders the **cached** `travel_legs` value, fully visible offline; when uncomputed/unavailable offline it shows `—` with a "needs connection" caption (no spinner). The single canonical placeholder for any missing leg is `—`.

**Day header.** Sticky `heading` bar: `Day 3 · Wed, Jun 7` left; right shows the **total day travel time** summed from cached legs as a teal `caption` (`◷ 47 min total`), the per-day travel-mode control, and a small "Open day in Google Maps" link. Card background, `--line` bottom border; today's header gets a `--sun-tint` wash + a Sun left accent bar.

**Bottom tab bar.** Fixed, 4 tabs (**Plan · Eats · Budget · Journal**), each `44px+` with line-icon + `label`. Active: Coral icon + label + 3px Coral top indicator; inactive: Ink-muted. Card background, `--line` top border, upward `shadow-lift`, `env(safe-area-inset-bottom)` padding. Hidden on Home; **visible in Map view** (Map is not full-screen).

**Toggles** (Plan's two segmented controls). Pill segmented control on Paper: track `card` with `shadow-inset`; active segment a Coral-filled pill with white `label`, sliding 180ms. Two equal-width segments, `44px` tall.

**Expense row** (Budget). `[category chip] note ............ amount`. Leading rounded-control tile carries the category color + glyph; middle shows `note` + `spent_on` (`caption`, Ink-muted) plus a tiny place-pin glyph if `linked_place_id` is set; right shows the amount in the global currency, **right-aligned, tabular**, rendered from minor units via the currency exponent. Subtotals and the breakdown reuse the same chip colors in a compact horizontal bar.

**Chips.** One pill primitive, `chip` radius, `--*-tint` bg + matching solid text: **Category** (per table), **Status** (`want-to-try` Sun-tint / `been` `--success`-tint w/ check), **Travel** (teal-tint), **Today** (Sun-tint), **Price** (`$`–`$$$$`, Ink-muted; 1 minimum). Chips are display-only, 28px tall, never wrap internally.

**Saved place card.** Same content as a place row minus the numbered pin; trailing one-tap **"+ Add to day"** Coral button opening a compact day-picker — promotion sets `day_date` + `order_index` as specified.

### 9.6 Mascot usage rules

The Siamese cat (`public/burgergo-logo.png` + small SVG poses) is a delight accent, used **only** in three contexts — never in dense data views, never as decorative framing on populated screens:

1. **Empty states** — one centered pose + a short `body` line + a single Coral action (no trips, empty Days/Saved/Eats/Budget/Journal, each with a context line). ~96–120px, muted on Paper.
2. **Loading** — first-load/blocking fetches only (trip opening, map booting): a small mascot with a gentle 1.2s bob + the teal trail dashing in. List/skeleton loads use shimmer skeletons, **not** the mascot.
3. **Onboarding** — first-run 2–3 screen intro (welcome, how Days/Saved work, the offline-read promise); shown once, gated by the `localStorage` flag `burgergo.onboarded` (§4.4).

Rules: at most **one mascot on screen at a time**; never blocks a primary action; in offline empty/error states the mascot stays (bundled asset) with a calm "You're offline — viewing saved data" caption rather than an error face.

### 9.7 Iconography

- **Single line-icon set**, self-hosted as inline SVG (Lucide-style) so icons render **offline** and inherit `currentColor` — no icon-font CDN. Stroke `1.75px`, `24px` grid (`20px` dense rows, `16px` chips), round caps/joins.
- **Semantic mapping:** tabs (map/route = Plan, fork-knife = Eats, wallet = Budget, book = Journal); categories per the table; travel modes (walk/car/transit); actions (plus, drag-handle, kebab, external-link for "Open in Google Maps", camera/upload, pin).
- Numbered pins and the mascot are the only raster/filled exceptions; everything else is monochrome line art tinted by role (Coral active, Ink-muted resting, Teal info).
- Every icon-only button carries a bilingual `aria-label` (via i18n).

### 9.8 Motion

Light, purposeful, fast; honor `prefers-reduced-motion` (disable all but opacity fades).

| Interaction | Motion | Duration / easing |
|---|---|---|
| Toggle / tab switch | Pill slide + crossfade | 180ms ease-out |
| Bottom sheet | Slide up + scrim fade | 240ms in / 200ms out ease-out |
| Drag-to-reorder | Row lifts (`shadow-lift`), neighbors reflow | 160ms spring-ish |
| Promote Saved → day | Card flies to day + pin number pops | 260ms ease-out |
| Press feedback | Scale to 0.97 + `--coral-press` | 90ms |
| Save confirmation | Success-tint check pulse | 240ms once |
| Mascot loading | Gentle bob + trail dash | 1.2s loop ease-in-out |
| Map polyline reveal | Route draws along path | 400ms ease-out (online only) |

No parallax, no long entrance choreography, no autoplay. Transitions cap at ~260ms (mascot bob excepted) so the app feels quick and clean.

---

## 10. Deployment & Operations

BurgerGo ships as a single self-contained Docker image plus a tiny `docker-compose.yml`. The owner runs it on their own private server, supplies their own TLS/reverse proxy, and is the only user. Operational footprint: one app container, one SQLite database file, one uploads directory.

### 10.1 Image: multi-stage Dockerfile (Next.js standalone)

The app uses Next.js `output: "standalone"` so the runtime image carries only the server bundle, minimal traced `node_modules`, and static assets.

1. **deps** — install deps on `node:22-bookworm-slim` with `python3`, `make`, `g++` so `node-gyp` can build `better-sqlite3` (native addon) against the runtime's Node/libc. `npm ci`.
2. **builder** — copy source + deps, `npm run build`. Produces `.next/standalone`, `.next/static`; runs `drizzle-kit generate` so SQL migrations are baked into `/app/drizzle`. The Serwist SW is compiled to `public/sw.js` here, and `public/burgergo-logo.png` + `public/icons/*` are generated from the source `assets/burgergo-logo.png`.
3. **runner** — clean `node:22-bookworm-slim` (NOT Alpine/musl — `better-sqlite3`'s compiled binary must match the runtime libc; staying on glibc bookworm end-to-end avoids a musl mismatch). Copy only `.next/standalone`, `.next/static`, `public/` (mascot logo, manifest, service worker, icons), `drizzle/`, and `scripts/`.

```dockerfile
# runner stage (sketch)
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN useradd -m -u 1001 burgergo
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public          # includes public/burgergo-logo.png + icons + sw.js
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh
RUN mkdir -p /data /data/uploads && chown -R burgergo /data
USER burgergo
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

**Native-module note:** build the image on the **same CPU arch** as the deploy target (arm64 vs amd64), or use `docker buildx --platform`. Keeping glibc (bookworm) end-to-end and copying the compiled binding through the standalone trace keeps the runner image small and runnable.

### 10.2 docker-compose

One service, two persistent mounts. SQLite DB and uploads must persist across image upgrades.

```yaml
services:
  app:
    image: burgergo:latest          # or build: .
    restart: unless-stopped
    ports:
      - "3000:3000"                 # bound behind the user's own proxy
    environment:
      DATABASE_PATH: /data/burgergo.db
      UPLOADS_DIR: /data/uploads
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      GOOGLE_MAPS_SERVER_KEY: ${GOOGLE_MAPS_SERVER_KEY}
      DEFAULT_CURRENCY: ${DEFAULT_CURRENCY:-USD}
      DEFAULT_LANGUAGE: ${DEFAULT_LANGUAGE:-en}
      TZ: ${TZ:-UTC}
    volumes:
      - burgergo-db:/data           # SQLite DB file + WAL
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

The DB file and its `-wal`/`-shm` companions sit under `/data`, uploads under `/data/uploads`, so a single volume tree holds all durable, offline-critical state.

### 10.3 Environment variables

Values come from a `.env` next to the compose file (never committed). The app reads `DEFAULT_CURRENCY` / `DEFAULT_LANGUAGE` only to seed the **Settings** row on first boot; thereafter the in-app Settings toggle is the source of truth.

| Var | Purpose | Required | Default |
| --- | --- | --- | --- |
| `DATABASE_PATH` | SQLite file path inside the container | yes | `/data/burgergo.db` |
| `UPLOADS_DIR` | Resized photo storage (places, journal, place/link thumbnails) | yes | `/data/uploads` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser key: Maps JS + Places Autocomplete (client-exposed; restrict by HTTP referrer) | yes | — |
| `GOOGLE_MAPS_SERVER_KEY` | Server key: Place Details, Directions, reverse-geocode, Photos (restrict by IP; never sent to client) | yes | — |
| `DEFAULT_CURRENCY` | Seeds `settings.currency` on first run | no | `USD` |
| `DEFAULT_LANGUAGE` | Seeds `settings.language` on first run (`en` \| `zh`) | no | `en` |
| `TZ` | Container timezone — "today" detection for active trips, consistent on server + client | no | `UTC` |

The two keys are intentionally distinct: the public key is referrer-restricted to the server's hostname; the server key is IP-restricted and powers the cached, cost-controlled Place Details / Directions calls (cached hard in SQLite — `travel_legs` recompute only when stops change).

### 10.4 HTTPS, reverse proxy & TLS (user-supplied)

PWA install and the in-app geolocation prompt require a **secure context** — HTTPS, or `localhost` for local testing. BurgerGo must be served over HTTPS in real use but bundles no proxy and manages no certs. The owner fronts the `:3000` container with their own reverse proxy:
- **Caddy** (simplest): automatic Let's Encrypt — recommended when the server has a domain.
- **nginx / Traefik**: fine if already running; terminate TLS and `proxy_pass` to `app:3000`.

Over plain HTTP / bare IP without TLS the app still functions as a website, but the service worker won't register for offline use and "Add to Home Screen" / geolocation are blocked. For an installable, offline-capable mobile PWA the owner needs a domain + TLS. The proxy must forward `X-Forwarded-Proto`/`Host` so Next.js generates correct absolute URLs for "Open in Google Maps" deep links and manifest scope.

### 10.5 Migrations on container start

The entrypoint applies pending Drizzle migrations **before** the server accepts traffic, using a **real programmatic migrator** (`scripts/migrate.ts` calling `migrate()` from `drizzle-orm/better-sqlite3` against `DATABASE_PATH`, reading the baked-in `/app/drizzle` folder). Migrations are idempotent — restarting an unchanged image is a no-op; an upgraded image applies new migrations automatically. On a brand-new volume this creates the schema and seeds the single `settings` row from `DEFAULT_CURRENCY` / `DEFAULT_LANGUAGE`.

```sh
# docker-entrypoint.sh (sketch)
#!/bin/sh
set -e
node ./scripts/migrate.js      # programmatic drizzle migrate() against DATABASE_PATH, from /app/drizzle
exec "$@"                       # -> node server.js
```

There is **no `|| fallback`** masking migration failure: if migration fails, the container exits non-zero and does not serve stale schema. SQLite runs in **WAL mode** for safe concurrent reads during the single user's writes. Exactly one writer (one user, one container) — no external DB server or pool. Do not run two app containers against the same DB file.

### 10.6 Backup & restore

All durable state is two paths: the SQLite DB (`/data/burgergo.db` + `-wal`/`-shm`) and `/data/uploads`. Back up both together so photo references always resolve.

**Backup (online-safe, no downtime)** — use SQLite's own backup so a mid-write checkpoint can't corrupt the copy:

```sh
# DB: consistent snapshot via sqlite3 .backup (handles WAL correctly)
docker compose exec app sh -c \
  'sqlite3 /data/burgergo.db ".backup /data/backup-$(date +%F).db"'
docker compose cp app:/data/backup-2026-06-05.db ./backups/

# Photos: plain archive of the uploads volume
docker run --rm -v burgergo-uploads:/u -v "$PWD/backups":/out \
  busybox tar czf /out/uploads-2026-06-05.tgz -C /u .
```

Never `cp` the live `.db` directly while running (you can miss WAL contents). For a cold backup, `docker compose stop app` first, then copy.

**Restore:** stop the app, drop the snapshot DB into the `burgergo-db` volume as `burgergo.db` (removing stale `-wal`/`-shm`), extract the uploads archive into `burgergo-uploads`, then start. Schedule backups via host cron; keep a few dated copies off-server.

### 10.7 Upgrade flow

Migrations are forward-only and run on boot, so upgrades are pull-and-restart:
1. **Back up first** (DB snapshot + uploads archive) — non-negotiable before any version bump.
2. Pull or rebuild: `docker compose pull` (or `docker compose build`).
3. `docker compose up -d` — Compose recreates `app` against the **same** volumes; the entrypoint applies new migrations before serving.
4. Verify: hit the app, confirm `GET /api/health` is green and the trips list loads.
5. **Rollback:** redeploy the previous image tag and, if a migration changed the schema, restore the pre-upgrade DB snapshot. Keep the prior image tag until the new version is confirmed good.

Volumes are never removed during an upgrade; only the container is replaced. **Avoid `docker compose down -v`** (the `-v` flag deletes the named volumes and would wipe all trips, places, expenses, journal entries, and photos).

---

## 11. Risks, Open Questions & Phased Milestones

### 11.1 Risks & Mitigations

| # | Risk | Impact | Mitigation (decided) |
|---|------|--------|---------------------|
| 1 | **Google Maps has no offline mode** — the in-app Maps JS API won't load without signal. | High (offline is a core promise). | **Resolved by design.** The in-app map is explicitly *online-only*. Every Place and day route carries an **"Open in Google Maps" deep-link**; offline the user hands off to the native app (its own offline maps + navigation). We never build turn-by-turn. Offline expectations are documented in onboarding and Settings so the blank map is understood, not a bug. |
| 2 | **`better-sqlite3` native module in Docker** — compiles against Node/V8 ABI; breaks across base-image, Node, or arch changes. | High (won't boot). | Multi-stage Dockerfile pins the exact Node version; native build in the builder stage, only the compiled artifact copied to the runner; **glibc bookworm end-to-end**; build for the deploy target's arch (`--platform`); migrations run on start before traffic; CI builds the same image the user deploys. |
| 3 | **Image storage growth** — phone photos on Places + Journal inflate the uploads volume and offline cache. | Medium (disk fill; slow precache). | **Resize server-side** on upload (cap dimensions, re-encode, strip originals) before writing; store web-optimized derivatives (thumb/card/full); the SW caches served, resized images only, with quota-aware trimming for non-pinned trips (pinned/"Available offline" trips exempt — §7.4). Document volume sizing + backup so the user can prune. |
| 4 | **Service-worker cache staleness** — a read-only cache can pin an old app shell or stale trip data after an online edit. | Medium (outdated itinerary/budget). | App shell uses **versioned precache + immediate activation** (build-hashed name; old caches purged on `activate`, `skipWaiting()`+`clients.claim()`). Trip data uses **stale-while-revalidate** (the single canonical strategy — §7.3): serve cache instantly, refresh in the background so an online device self-heals. Because there is **no offline editing**, the cache is a pure read mirror — no write-conflict reconciliation. |
| 5 | **No auth on a public IP** — anyone reaching the URL reaches the single user's private data. | High (data exposure). | Deliberate single-user decision, **but the app must not sit unprotected on the open internet.** Required (not optional) in deploy docs: **network-level protection** — a VPN/Tailscale-style private network, or the user's reverse proxy enforcing IP allowlisting and/or HTTP Basic Auth + TLS. (PWA install + geolocation already require HTTPS/localhost, nudging toward a proper proxy.) |
| 6 | **Google Maps cost creep / quota** — Autocomplete, Place Details, Directions are billed per call. | Low (one user), but guarded. | Locked cost controls: **Autocomplete session tokens**, **Place Details cached** in `place_details_cache`, **Directions cached hard** in `travel_legs` (recompute only when stops change), minimized JS map loads; key restrictions (referrer/IP) so a leak can't be abused. |
| 7 | **Drag-to-reorder + `order_index` integrity** — reordering or promoting must keep `order_index` consistent and invalidate the right `travel_legs`. | Medium (wrong route / stale times). | Reordering and day-assignment run in a **single transaction** that rewrites affected `order_index` values and **deletes now-invalid `travel_legs` rows** for that day (recompute on next online view). Promotion is one write: set `day_date` + append `order_index`. |

### 11.2 Open Questions (confirm during build)

- **Photo cap & retention** — exact max dimension / target file size for the resized derivatives, and whether to keep any original. Affects offline cache footprint (Risk 3). *Recommendation: store the three derivatives only; do not keep originals.*
- **Currency switching** — single global currency; if the user changes it later, existing `expenses.amount` values **stay as-entered (relabeled only), no retroactive conversion** (recommended default; confirm).
- **Offline cache scope** — cache **all trips** (single user, modest data) and revisit only if the precache grows uncomfortable; pinned-trip photos are eviction-exempt (§7.4).
- **Trip date-range edits** — when dates shrink below scheduled places, **never silently delete**: surface affected places for the user to reassign or move to Saved (`day_date = NULL`).
- **Reverse-geocode failure** — on a map-drop with no usable address, **save coords-only with an editable name** (do not block the save); `google_place_id = NULL`, no cache row.

### 11.3 Resolved during assembly (formerly open)

These were ambiguous across drafts and are now **locked** in the spec above:

- **Schedule field name:** locked `day_id` is implemented as `day_date` (§5.3).
- **Restaurant-created Place:** category defaults to **`other`**; name/notes copied once at creation (not live-synced); deleting the Place clears `linked_place_id` (un-schedules), surfaced in the UI (§4.1).
- **Today "next un-passed stop":** transient client-only pointer, no `passed` field, does not persist (§3.8).
- **Travel mode:** per-day with optional explicit-online per-leg override (§3.4.1).
- **Saved-link OG fetch:** kept, via `POST /api/links/preview`, thumbnail stored on the uploads volume (§4.3, §8.2).
- **Google place photo source for thumbnails:** `place_details_cache.photo_local_path`, with the §5.6 precedence — not a `photos` row.

### 11.4 Scope notes (kept, trimmed, or deferred)

- **Skip / Next stop** (Today card): **kept** but explicitly scoped as a transient client-only pointer that does **not** persist (§3.8).
- **Per-leg mode toggle:** **trimmed** to per-day mode with an optional explicit-online per-leg override, preserving the cost-control narrative (§3.4.1).
- **Saved-link auto-fetch:** **kept** as a confirmed addition with a dedicated route handler (§4.3, §8.2).
- **Photo LRU eviction:** **kept** but reconciled so pinned/"Available offline" trips are eviction-exempt (§7.4), honoring "all photos readable offline."
- **Captive-portal heartbeat:** **deferred** — v1 uses `navigator.onLine` only; no app-server ping endpoint is introduced (§7.6).
- **Recent-cuisine suggestions, Eats multi-sort, Saved category-filter chips, manual leg "recompute":** **kept as optional polish**, flagged as not locked scope; the manual recompute can only refetch current adjacencies and cannot bypass the cache-hard rule.

### 11.5 Phased Milestones

Each phase is an independently **shippable slice** — installable, offline-readable, useful on a phone on its own.

**Phase 1 — MVP: the planning core**
- Home (trips list with Sun→Coral cover cards), **new trip**, rename, concrete `start_date`/`end_date`, auto-generated **Days** (derived; Day 1 = start_date, weekday shown, container `TZ`).
- Plan tab with **List ⇄ Map** and **Days ⇄ Saved** toggles (URL state: `view`, `bucket`, `date`).
  - **Days:** per-day ordered Places with numbered pins (`order_index + 1`), drag-to-reorder, add via **Google Places Autocomplete** (session tokens) and **long-press-to-drop-pin** with reverse-geocode; Place Details auto-fill (name/address/coords/photo/category) into `place_details_cache`.
  - **Saved** wishlist bucket (`day_date = NULL`) with **one-tap promote**.
  - **Map:** Google JS map of trip pins + ordered route polylines, per-day color/icon + visibility filter.
- **"Open in Google Maps"** deep-links (enum→URL mode mapping) on every Place and per day route.
- **"Today"** behavior: active trip auto-lands Plan/Days on today's date with the transient next-stop card.
- **PWA + Serwist service worker:** app shell + all trip data (JSON endpoints) cached for **offline read** (no offline editing).
- Drizzle schema + drizzle-kit migrations for trips, places, place_details_cache, travel_legs (groundwork), settings; read Route Handlers (`/api/trips/…`, `/api/health`); Dockerfile + docker-compose (app + SQLite volume + uploads volume) with the HTTPS / network-protection notes.

**Phase 2 — execution detail: eats, money, time, photos**
- **EATS:** `restaurants` per trip — cuisine, rating, `status`, `price_level`, notes, optional `linked_place_id` schedule link (creates a `category = other` Place per §4.1).
- **BUDGET:** log **actual** `expenses` by category, `spent_on`, optional `linked_place_id`; totals + breakdown **by category and by day** in the single currency (minor units + exponent map). Schema leaves room for a future planned budget.
- **Per-leg travel time:** Google **Directions** for the day's mode between consecutive stops, **cached hard** in `travel_legs`; cached value shows offline, recompute only when stops change.
- **Photos:** phone upload on Places + (groundwork for) Journal, **resized server-side** (thumb/card/full), stored on the uploads volume, served by the app and **cached for offline viewing** (pinned-trip exemption).

**Phase 3 — capture, reading & polish**
- **JOURNAL:** markdown `journal_entries` (title, body, optional `entry_date`, photos) + **`saved_links`** reading list with `POST /api/links/preview` OG/title prefill (thumbnail to uploads volume).
- **i18n:** full EN + Simplified Chinese via next-intl, cookie-driven, toggled in Settings (free-text content stays any language).
- **Today refinements:** next-stop card polish, prominent "Open in Google Maps" hand-off, smoother active-trip landing.
- Visual polish across the **"Sunset Wanderer"** system — Coral `#EE5B3C` actions, Teal `#4F8A86` accents, Ink `#6E5544` text, Paper `#F5EEE1` / Card `#FBF7EF` surfaces, Sun `#F2C879` highlights, 16px rounded cards, soft shadows; **mascot cat** in empty/loading/onboarding states.
