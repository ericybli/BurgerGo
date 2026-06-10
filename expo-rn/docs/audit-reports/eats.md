# eats audit

Checked: 92

## Must-fix
- Google review count loses thousands grouping
- Empty/error states missing the 112×112 mascot logo
- Curly apostrophes in 6 strings deviate from en.json (straight quotes)
- Segmented-control inactive label color: faint instead of sub

## Accepted/platform
- Photo add/delete keeps the detail sheet open (web closes it) [acceptable]
- Failed re-fetch keeps stale list instead of flipping to error; error state adds Retry [acceptable]
- Add-photo control is one outlined button; all actions disabled during upload [acceptable]
- Add mode saves via POST then PATCH (non-atomic) instead of one server action [acceptable]
- Extra OfflineHint line and Name autoFocus not present on web [acceptable]
- Native control substitutions: modal Select, no backdrop-tap close on photo viewer, no scrim blur/Escape [platform-constraint]
- Solid accent toggle disabled style uses surface+faint instead of web's opacity-40 [acceptable]

## Fix report
GAP STATUS (eats):

1. Google review count loses thousands grouping — FIXED. `/Users/eric/own/BurgerGo/expo-rn/screens/eats/RestaurantDetail.tsx` now renders `restaurant.googleRatingCount.toLocaleString('en-US')` (pluralization unchanged), matching web's ICU `#` grouping → "· 1,234 reviews".

2. Empty/error states missing the 112×112 mascot logo — FIXED in the shared kit at the audit's explicit rnTarget `/Users/eric/own/BurgerGo/expo-rn/components/ui/index.tsx`: EmptyState now renders the bundled `expo-rn/assets/burgergo-logo.png` at 112×112, opacity 0.9, above the headline (marginBottom 18 + container gap 6 = web's mb-6/24px). ErrorState inherits it via EmptyState, so both "No eats logged yet" and "Couldn't load your eats" (and every other section using the kit) get the mascot.

3. Curly apostrophes in 6 strings — FIXED, all six: EatsScreen.tsx ("Couldn't load your eats"), RestaurantForm.tsx ("Couldn't save — please try again.", "We'll map it for you."), RestaurantDetail.tsx (2× "Couldn't upload — please try again.", 1× "Couldn't save — please try again."). Verified zero U+2019 remain under expo-rn/screens/eats/.

4. Segmented-control inactive label color — ALREADY CORRECT at fix time: `s.segmentText` in components/ui/index.tsx already used `colors.sub` (a concurrent agent evidently landed the token change). I fixed the remaining contradiction the audit flagged: the kit's doc comment ("inactive = faint text") now reads "inactive = sub text (web EatsClient)". No other change needed.

Acceptable/platform items: skipped per instructions.

FILES CHANGED:
- /Users/eric/own/BurgerGo/expo-rn/screens/eats/EatsScreen.tsx
- /Users/eric/own/BurgerGo/expo-rn/screens/eats/RestaurantForm.tsx
- /Users/eric/own/BurgerGo/expo-rn/screens/eats/RestaurantDetail.tsx
- /Users/eric/own/BurgerGo/expo-rn/components/ui/index.tsx (audit-granted rnTarget for gaps 2 and 4)

GATE: `npx tsc --noEmit` in expo-rn → exit 0, zero errors.