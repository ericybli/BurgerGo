# budget audit

Checked: 78

## Must-fix
- formatMoney renders 4 Settings currencies differently from web (CNY, SGD, THB, CAD)
- Empty/error states are missing the mascot image
- Atlas token deviations in shared kit: scrim alpha, missing sheet shadow, segmented inactive color, OfflineHint styling

## Accepted/platform
- Two-tap delete confirm where web deletes immediately [acceptable]
- Free-text YYYY-MM-DD date field instead of native date picker [acceptable]
- Modal list picker replaces native <select> for Category and Link a place [acceptable]
- Spec-blessed RN extras: Retry button, stale-data on refetch failure, focus refetch, spinner, amount autoFocus/placeholders [acceptable]
- Minor sizing nits vs web (no functional impact) [acceptable]

## Fix report
All gates pass. Final verification of the report facts is complete.

GAP 1 — formatMoney parity (CNY/SGD/THB/CAD): **FIXED (budget-scoped)**
- New `/Users/eric/own/BurgerGo/expo-rn/screens/budget/money.ts`: `Intl.NumberFormat('en', {style:'currency', min/maxFractionDigits: exponent})` exactly mirroring web `src/lib/currency.ts`, with per-currency formatter cache and runtime probe falling back to the lib symbol-map formatter if Intl lacks currency data. Verified output for all 16 Settings currencies matches web byte-for-byte (CNY "CN¥1,234.56", SGD "SGD 1,234.56", THB "THB 1,234.56", CAD "CA$1,234.56", CHF NBSP, negatives, zero/3-exponent codes). BudgetScreen now imports `formatMoney` from `./money`; every Budget money string (headline, category amounts, remaining labels, group totals, row amounts) uses it.
- RESIDUAL: the audit's preferred target `expo-rn/lib/currency.ts` is foundation-owned (lib/** edit-forbidden for this agent), so other sections using lib `formatMoney` still need the lib-level fold-in.

GAP 2 — mascot in empty/error states: **FIXED (budget-scoped)**
- `MascotState` in new `/Users/eric/own/BurgerGo/expo-rn/screens/budget/ui.tsx`: web `components/EmptyState.tsx` parity — bundled 112px mascot at 90% opacity, marginBottom 24, `type.heading` ink headline, `type.body` sub subtext (maxWidth 320), alt "Budget" (= web `t('summaryTitle')`). Replaces kit `EmptyState` ("No expenses yet") and `ErrorState` ("Couldn't load this budget", spec-blessed Retry kept as secondary-button action, `fill` centers screen-level error).
- RESIDUAL: kit-level `components/ui/index.tsx` EmptyState/ErrorState remain text-only for other sections (path forbidden to me).

GAP 3 — Atlas token deviations: **FIXED for Budget (3 of 4 sub-items budget-scoped; 1 already fixed in kit)**
- (1) Scrim 0.42: local `BudgetSheet` (both sheets) and `BudgetSelect` (Category + Link-a-place picker backdrops) in `ui.tsx` use web `--scrim` rgba(27,31,28,0.42); kit recipes otherwise replicated verbatim. RESIDUAL: `theme.ts` colors.scrim still 0.35 for other sections.
- (2) Sheet shadow: exported `sheetShadow` (shadowColor ink, offset 0/-12, opacity 0.25, radius 40 = web `shadow-sheet`; exact box-shadow on react-native-web) passed to both `SheetPanel`s via its existing `style` prop. Android elevation cannot cast upward — platform constraint, left without elevation.
- (3) Segmented inactive color: ALREADY FIXED in the shared kit working tree (`segmentText` now `colors.sub`, uncommitted change by a concurrent kit-level edit — verified present via git diff; not made by me). No budget-side action needed.
- (4) OfflineHint: replaced with local `OfflineNote` — `type.caption` (12 medium) in `colors.sub`, non-italic, matching web `text-caption text-sub`; used in both forms. RESIDUAL: kit `OfflineHint` unchanged for other sections.

GATE: `npx tsc --noEmit` in expo-rn → exit 0, zero errors.

Files changed (all within assigned paths):
- /Users/eric/own/BurgerGo/expo-rn/screens/budget/money.ts (new)
- /Users/eric/own/BurgerGo/expo-rn/screens/budget/ui.tsx (new)
- /Users/eric/own/BurgerGo/expo-rn/screens/budget/BudgetScreen.tsx (imports + 9 usage swaps: error/empty states, 2× Sheet→BudgetSheet, 2× SheetPanel shadow, 2× Select→BudgetSelect, 2× OfflineHint→OfflineNote)

NOTE FOR ORCHESTRATOR: all three gaps' rnTargets were shared foundation files (expo-rn/lib/currency.ts, expo-rn/lib/theme.ts, expo-rn/components/ui/index.tsx) that my path rules forbid. Budget now has exact web parity via section-local equivalents (each documented with a fold-back note), but a kit-owner pass on those three files is still needed so Eats/Home/Settings/etc. inherit the same fixes app-wide.