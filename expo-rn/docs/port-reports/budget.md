Gate passed: `npx tsc --noEmit` reports 0 errors in `screens/budget/**` (remaining errors are in `screens/eats` and `screens/home`, owned by concurrent agents).

FILES
- Rewrote: /Users/eric/own/BurgerGo/expo-rn/screens/budget/BudgetScreen.tsx (Atlas Light restyle + all behavior gaps)
- Created: /Users/eric/own/BurgerGo/expo-rn/screens/budget/SwipeRow.tsx (local PanResponder+Animated swipeable row — no new deps; react-native-gesture-handler is not installed and I cannot add packages)

SPEC ITEMS COMPLETED (numbering from docs/parity/budget.md "Gaps to build")
1. Atlas retheme — summary card = white bg + 1px `line` border radius 16; flat rows; no shadows; teal accent progress fill (danger when over); all text via `font.*`/`type.*` (no bare fontWeight); legacy coral/paper/card tokens removed from this section.
2. Summary header/headline — `OVERALL` micro-uppercase-faint + bordered Set budget/Edit budget button (border line, radius 10, ink label); 30px bold headline (no "Spent" label), `{spent} of {planned}` when planned set, spent-only when null; 5px/radius-3 bar animating width 500ms with accessibilityRole/value; overall remaining left-aligned, category remaining right-aligned; categories separated by hairline dividers, none after last (`last:pb-0` matched).
3. Controls one row — segmented (By category | By day, default day) left, orange Add expense right, space-between.
4. Flat hairline expense rows — full-width press target, hairline bottom border, 14px semibold primary (`note ?? categoryLabel`), surface place chip, bold tabular amount; always-visible ✕ removed; offline = disabled + opacity 0.6.
5. Swipe actions — local SwipeRow (76px actions, snap at half, horizontal-dominant gesture so vertical scroll wins, tap-on-open closes, disabled offline): Edit (accent) + Delete (danger). Delete is two-tap ("Delete" → "Sure?", 3s auto-disarm, disarm on row close) instead of Alert.alert per cross-platform rule; delete always refetches via `finally` (web parity). Tap-to-edit kept; delete also reachable in the edit sheet, so swipe is never the only path.
6. By-day section headers — date micro/faint/tabular + total caption/sub/tabular; by-category header micro/faint uppercase, no total.
7. SetBudget remount bug — sheet keyed on an open-counter (`budget-${n}` incremented per open), re-seeds from current targets every open.
8. Sheet chrome/buttons — both sheets use kit Sheet+SheetPanel (radius 22, handle, sheet shadow, scrim); bordered error banner (caption danger) + offline hint above fields; full-width stack Save (orange) → Delete (danger text, edit only, two-tap) → Cancel (bordered, never disabled); inputs/selects now disabled offline (web parity); amount/date/target inputs tabular-nums; content capped ~85% height via ScrollView.
10. Date field — free-text YYYY-MM-DD placeholder kept; server 400 surfaces as "Couldn't save — please try again."
11. Error-state strings — exact en.json strings ("Couldn't load this budget" straight apostrophe, matching web); RN Retry kept (spec-sanctioned extra); stale-data-preserving behavior kept.
12. Fade-up stagger — sections animate 8px translate-up/fade, 420ms, `min(i,6)*40ms` delay (JS driver on web to avoid useNativeDriver warning).

NOT DONE
- Gap 9 (formatMoney Intl parity): `formatMoney` lives in `expo-rn/lib/currency.ts`, which is outside my assigned paths (lib/** is edit-forbidden). The existing symbol-map formatter already emits grouping + exponent-fixed decimals ("$1,234.56", "¥1,500") identical to web for all mapped currencies; only unmapped codes render as "CODE 1,234.56" instead of Intl narrow symbols. Left as-is.
- Gap 1's "Replace expo-rn/lib/theme.ts palette": theme.ts is already Atlas Light and is lib-owned; only budget styles needed (and got) migration.
- Optional platform date picker (gap 10): skipped per cross-platform rules (plain text input pattern).

CONTRACT ASSUMPTIONS
- `api.budget.clearTarget(tripId, null)` omits the `category` query param → clears the overall target (verified in lib/api/index.ts).
- Sheet forms also remount on close (conditional render inside Sheet), so the key-per-open is belt-and-braces.
- Two-tap confirm replaces the spec's "native Alert confirm is acceptable" note, per the harder system rule that Alert.alert is a no-op on react-native-web.