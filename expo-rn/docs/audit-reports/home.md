# home audit

Checked: 56

## Must-fix
- Trip header date subtitle missing after opening a trip (spec Gap 11)
- Home header settings chip loses the surface-chip treatment (and wrong icon size)
- Scrim token is 0.35 opacity; web is 0.42
- Cover-fallback gradient is a 12-band vertical approximation, not the web's smooth 135° gradient
- Mascot images have no accessibility label ('BurgerGo the Siamese cat')
- ManageTripSheet text inputs have no focus state

## Accepted/platform
- RN-only 'Delete trip' control in ManageTripSheet (web Home has no delete UI) [acceptable]
- Plain-text YYYY-MM-DD date fields with RN-only format-error strings [acceptable]
- Trip status / 'days out' resolved in device TZ instead of server env.TZ [acceptable]
- Sheet chrome micro-deviations in the shared UI kit [acceptable]
- Busy buttons swap their label for '…' while pending [acceptable]
- Focus-refetch resilience: stale list kept on background failure; retry shows loading first [acceptable]
- VERIFIED: add/remove day now works end-to-end against the deployed PATCH contract [acceptable]

## Fix report
GATE PASSED: `npx tsc --noEmit` reports zero errors referencing my files; the only errors are in `screens/budget/BudgetScreen.tsx` (a concurrent agent's in-flight section, outside my paths).

PER-GAP STATUS

1. Trip header date subtitle (spec Gap 11) — FIXED. `/Users/eric/own/BurgerGo/expo-rn/App.tsx` Trip Stack.Screen now renders a custom `headerTitle`: trip name (font.bold 17, ink) over "{MMM d} – {MMM d}" (en dash, font.medium 12, sub, tabular-nums) built from `formatMonthDay` in `expo-rn/screens/home/tripDates.ts` (UTC-parsed, matching web `formatSubtitle`). `title: route.params.name` kept for back-label/fallback.

2. Home settings chip + header alignment — FIXED. `App.tsx` headerRight is now a 36×36 `colors.surface` chip, borderRadius 999, lucide Settings size 18 ink, pressed scale 0.95, accessibilityRole button. Secondary note also fixed in `expo-rn/screens/home/HomeScreen.tsx`: logo+wordmark moved from `headerTitle` to `headerLeft` (`headerTitle: () => null`) so it stays left-aligned on iOS native-stack like the web header.

3. Scrim token 0.35 → 0.42 — FIXED. `/Users/eric/own/BurgerGo/expo-rn/lib/theme.ts` line 25 now `rgba(27, 31, 28, 0.42)` (path explicitly granted by the audit's rnTarget; one-line token change, app-wide).

4. Cover-fallback gradient — FIXED, with one deviation from the prescribed mechanism: `expo-linear-gradient` is NOT installed (absent from `expo-rn/package.json` and node_modules; I'm barred from npm/package.json). Implemented instead with `react-native-svg` 15.12.1 (direct dependency, bundled in Expo Go, RN-web compatible): `CoverGradient` in `expo-rn/screens/home/TripCard.tsx` now renders a single smooth SVG gradient whose `userSpaceOnUse` endpoints (center ± (w+h)/4 per axis, measured via onLayout) reproduce the CSS `linear-gradient(135deg, #F7F1E4 0%, #EDF1EE 55%, #E6EFF1 100%)` gradient line exactly — true 135° in pixel space, stops 0/0.55/1, no banding. Unique gradient id per card instance (useId) to avoid id collisions in the RN-web document; #EDF1EE solid fill pre-layout to avoid flash. Band-approximation code (mixHex/gradientColorAt/BANDS) deleted. If the orchestrator later adds expo-linear-gradient as a dependency, this can be swapped, but the SVG version is already visually exact.

5. Mascot accessibility labels — FIXED. Both the LoadingState `Animated.Image` and the MascotState `Image` (covers error + empty states) in `HomeScreen.tsx` now carry `accessible` + `accessibilityLabel="BurgerGo the Siamese cat"`, matching web `mascot.alt`.

6. ManageTripSheet input focus state — FIXED. The local `Input` in `expo-rn/screens/home/ManageTripSheet.tsx` now tracks focus and applies `inputFocused: { borderColor: colors.accent }` (the kit Field's exact focus recipe, per the audit's prescribed fix), forwarding any caller onFocus/onBlur.

FILES CHANGED
- /Users/eric/own/BurgerGo/expo-rn/App.tsx (gaps 1, 2 — path granted by audit rnTarget)
- /Users/eric/own/BurgerGo/expo-rn/lib/theme.ts (gap 3 — path granted by audit rnTarget; single token line only)
- /Users/eric/own/BurgerGo/expo-rn/screens/home/HomeScreen.tsx (gaps 2-secondary, 5)
- /Users/eric/own/BurgerGo/expo-rn/screens/home/TripCard.tsx (gap 4)
- /Users/eric/own/BurgerGo/expo-rn/screens/home/ManageTripSheet.tsx (gap 6)

Acceptable/platform items from the audit (RN-only delete control, plain-text date fields, device-TZ status, sheet chrome micro-deviations, '…' busy labels, focus-refetch behavior): intentionally not touched.