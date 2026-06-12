# expo-rn: Liquid Glass + data-source dot + clear-offline (Design)

**Date:** 2026-06-12 · **Status:** approved (user: "直接开始")
**Scope:** expo-rn ONLY. Zero functional changes for item 3; items 1–2 are small additive features.

## 1. Data-source dot

A global 8px dot, absolutely positioned in the top-right safe area, visible on every screen, non-blocking. **Green = live data, red = cached/offline data** — driven by actual data source, not just connectivity:

- `lib/dataSource.ts`: tiny module store (`'live' | 'cache'`, subscribe/report). `client.ts#getJson` reports `live` on network success and `cache` when it falls back to the JSON cache. `useOnline() === false` forces the red display regardless of the last report.
- Tapping the dot shows a transient (3s) glass label: "Live data" / "Offline data — downloaded <formatted offline-meta ts>" (meta from `getOfflineMeta()`; omit the time when no meta).
- New theme token `colors.success` (green; pick a hue that sits well with Atlas: `#2E9E5B`-ish). Red reuses `colors.danger`.
- Component `components/DataSourceDot.tsx`, mounted once in App.tsx above the navigator (sibling of OfflineBanner; the banner stays as-is).

## 2. Clear offline data

Settings ▸ Offline card gains a "Clear offline data" control (danger-text pill, two-tap confirm, 3s auto-disarm — house pattern):

- Calls existing `clearJsonCache()` + `clearPhotoCache()` + `setOfflineMeta(null)`; resets the card to the pristine "Download for offline" state (meta line disappears).
- Works offline too (local-only operation). Auth latch + SecureStore untouched. Shown only when offline meta exists.

## 3. Liquid Glass port (visual only)

Source of truth: `/Users/eric/Downloads/handoff_liquid_glass/LIQUID_GLASS_MOTION.md` + `demo/liquid/lg-styles.css` (copy into `expo-rn/docs/handoff/liquid-glass/` for the repo record). Principle: **content is never glass; chrome is always glass.**

New deps: `expo-blur`, `expo-linear-gradient` (SDK modules; require an `eas build` to ship — OTA cannot add native modules).

Glass recipe in RN (`components/ui/glass.tsx`): `<GlassPlate>` = BlurView(intensity≈20 ≅ 4px, tint light) + absolute white linear-gradient overlay (155°, opacities per the CSS vars: tint 0.5 ±0.22/−0.06/+0.10) + 0.5px white border (0.65) + lift shadow; `<GlassTintPlate>` for orange/teal CTAs (brand rgba 0.85 + lighter blur). No saturation boost on RN — accepted approximation.

Effect-by-effect (numbers = handoff §3):

| # | Decision |
|---|---|
| 3 Tab bar | Custom `tabBar` for the trip bottom-tabs: floating pill (left/right 14, bottom 24, radius 999) on GlassPlate; sliding active pill (Animated spring 420ms + scaleX1.14/scaleY0.86 squish 250ms); icon/label color 260ms; screens get ~150px bottom scroll padding |
| 4 Day strip | Sliding ink pill behind chips, Animated spring 380ms |
| 11 Sheets | Kit `Sheet`/`SheetPanel`: translateY(46)+fade entrance 380ms overshoot; backdrop fade 240ms; panel becomes GlassPlate radius 26 inset 8 |
| 10 Press | Kit Button/IconButton/PillButton/chips: pressed scale 0.94, release spring 240ms |
| 1 List stagger | Itinerary day list (Plan list view) on mount & day change: translateY(18)+fade, delay i×45ms (cap ~12 rows) |
| 8 FAB | Home FAB on GlassTintPlate; breathing shadow/scale loop 2.6s |
| 5/6 Map pins + dash | WebView map only: inject the handoff's ORIGINAL CSS into `webviewMapHtml.ts` (pin drop-in keyframes are safe there — frame-0 benign per handoff pitfall #1 guidance: use the transition pattern anyway), dash crawl on polylines → switch route lines to dotted 1 7 + dashoffset loop. Native fallback canvas (offline/Android) untouched |
| 9 View fades | List↔Map segmented switch: opacity 300ms + scale 0.985→1 spring |
| 7 Shimmer | Tab bar specular sweep via expo-linear-gradient strip, skew −16°, 5.4s loop (stretch; ship if it stays smooth) |
| 2 Header compress | SKIPPED (native-stack title scaling not worth the invasiveness). Headers get a static glass treatment: `headerTransparent` + BlurView background on Trip/Settings; Home in-page header gets `.lg-bar`-style gradient |
| Reduced motion | `AccessibilityInfo.isReduceMotionEnabled` hook: loops off, entrances render at final state |

Constraints: animate only transform/opacity/shadow/color (core `Animated`, no reanimated); no per-frame JS; all existing props/handlers/behavior unchanged; gates = `npm run typecheck` + `expo export` both platforms + visual self-check via `npm run web` (expo-blur → backdrop-filter on web).

## Rollout

Items 1+2+3 ship together in one `eas build -p ios --profile preview` (new native modules). Update parity docs note: web does NOT get this treatment (RN-only by user decision).
