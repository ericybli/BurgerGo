# Liquid Glass port — what shipped (2026-06-12)

RN approximation of `docs/handoff/liquid-glass/` (the handoff targets web CSS; this app is the only consumer — the web app stays Atlas Light by user decision). Principle preserved: **content is never glass, chrome is always glass.**

## Primitives

- `components/ui/glass.tsx` — `GlassPlate` (core plate; `strength="sheet"` adds +0.15 tint), `GlassTintPlate` (brand-color glass; orange default, teal `rgba(51,103,122,0.85)`), `GlassBar` (square top chrome). BlurView intensity 20 ≈ the handoff's blur(4px); **no saturate() on RN** — accepted difference vs web CSS.
  - Outer/inner split: sizing/position style keys ride the OUTER (shadow) view, the rest the INNER (clipped) view. Inner has `flexGrow: 1` (fills fixed-size outers) and glaze layers carry `zIndex: -1` (web paints positioned siblings above static children otherwise).
- `components/ui/motion.ts` — `useReduceMotion`, `springy` (≈ cubic-bezier(0.34,1.4,0.64,1)), `useEnter`, `usePressScale`. Core `Animated` only; no reanimated.

## Effects (handoff §3 → RN)

| # | Status |
|---|---|
| 3 Floating tab pill + sliding active pill + squish | ✅ `navigation/GlassTabBar.tsx`; screens got ~150px bottom scroll padding; `tabBarSpace()` helper for other chrome |
| 7 Specular sweep | ✅ approximation (LinearGradient strip, static skew + animated translateX; 2s sweep / 3.4s idle) |
| 4 Day-strip ink pill | ✅ JS-driven spring (translateX+width — chips aren't uniform width) |
| 11 Sheet entrance + glass panel | ✅ kit Sheet/SheetPanel; backdrop now 0.30 (handoff value, was 0.42 scrim); close stays instant |
| 10 Press scale | ✅ kit Button/IconButton + PillButton |
| 1 List stagger | ✅ DayItinerary rows, keyed by day date, delay capped at 12×45ms |
| 8 FAB breathing | ✅ scale 1→1.04 + glow halo opacity pulse (RN can't animate shadows natively) |
| 5 Pin drop-in / 6 flow overlay | ✅ **WebView (iOS) canvas only** — original handoff CSS injected into `webviewMapHtml.ts`; routes are solid lines + flowing white streak overlay (user-tuned from dotted crawl). expo-web debug uses `PlanMap.web` (solid lines, no drop-in) and the native fallback canvas is untouched — both out of scope |
| 9 List↔Map cross-fade | ✅ `useCrossFade` wrapper (opacity + scale; skips initial mount) |
| 2 Header compress on scroll | ❌ skipped (native-stack title scaling too invasive); headers are static `GlassBar` via `headerTransparent` |
| Reduced motion | ✅ all loops skipped, entrances render final state |

## Also in this batch (non-glass)

- **Data-source dot**: `components/DataSourceDot.tsx` + `lib/dataSource.ts` — green = live, red = cached/offline; fed by `getJson` (real data source, not just connectivity); tap = 3s label with the offline-download timestamp.
- **Clear offline data**: Settings ▸ Offline, two-tap; wipes JSON cache + photo cache + meta.
- **expo-web debug channel**: `.env.local` with `EXPO_PUBLIC_API_BASE=http://localhost:3000` + `EXPO_PUBLIC_API_KEY=<backend BURGERGO_API_KEY>` authenticates as the machine principal and skips the login gate (web debug only; real builds never set it). Note: `/api/me` 404s for machine principals, so ProfileCard hides itself in this mode — expected.

## Known web-debug-only quirks

- RouteLinks row on the inline map can tuck under the floating tab bar on web (inset math differs without safe-area); verify on device.
- Stale Metro caches ignore changed `EXPO_PUBLIC_*` values — restart with `--clear`.
