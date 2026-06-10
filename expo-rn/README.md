# BurgerGo — native app (Expo / React Native)

Full-feature React Native client for BurgerGo, living inside the main repo.
Expo SDK 54, React Native 0.81, TypeScript strict. UI is **Atlas Light** —
the same design system as the web app (`lib/theme.ts` mirrors
`tailwind.config.ts`; Instrument Sans, hairline borders, teal accent = info/nav,
orange = create/save).

## Run

```bash
cd expo-rn
npm install
cp .env.example .env       # fill EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY for the web map
npm run web                # debug in a browser (react-native-web)
npm start                  # QR code for Expo Go on a phone (iOS/Android)
```

The app talks to the hosted backend (`EXPO_PUBLIC_API_BASE`, default
`https://eric.month2month.com/burgergo`). Reads are public GET routes; writes
are REST wrappers around the web app's Server Actions (CORS is enabled
server-side so the web build works from localhost).

## Layout

- `App.tsx` — fonts (Instrument Sans), root stack (Home / Trip / Settings)
- `navigation/` — per-trip bottom tabs: Plan · Eats · Tickets · Budget · To do · Journal
- `lib/theme.ts` — Atlas tokens (colors, type scale, radii, day colors)
- `lib/api/` — namespaced REST client (`api.trips`, `api.places`, `api.tickets`, …)
- `components/ui/` — shared kit (Button, Field, SegmentedControl, Sheet, …)
- `screens/<section>/` — one folder per tab
- `screens/plan/PlanMap.native.tsx` / `PlanMap.web.tsx` — platform-split map
  (react-native-maps in Expo Go; Google Maps JS on web) behind one props
  contract (`PlanMap.types.ts`)
- `docs/parity/` — per-section feature-parity specs vs the web app

## Gates

```bash
npx tsc --noEmit
npx expo export --platform web
npx expo export --platform ios
```

## Notes

- Expo Go only (no dev build): native map uses Apple Maps on iOS, so basemap
  POI tap-to-save is web/Android-only; everything else is identical.
- No server in here: this is a pure client. All data lives in the hosted
  backend.
