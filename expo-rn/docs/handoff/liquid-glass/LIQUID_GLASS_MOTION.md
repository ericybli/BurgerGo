# Handoff Addendum: Liquid Glass + Motion Layer

For the BurgerGo app already restyled per `README.md` (Atlas Light). This addendum adds ONLY two things: a **liquid-glass treatment for floating chrome** and a **motion system**. No functional changes; content layer (white bg, ink text, hairlines) stays exactly as implemented.

Live reference: `demo/BurgerGo Liquid Glass.html` (open over a static server from this folder's root; interactive — scroll the list, switch List/Map, tap a stop, switch tabs, Tweaks panel top-right).

---

## 1. Design principle

**Content is never glass. Chrome is always glass.** Anything that floats OVER scrolling content becomes a translucent, blurred plate; everything in the document flow keeps the existing Atlas Light styling. If an element doesn't overlap moving content, it does not get glass.

Glass surfaces in the app:

| Surface | Real component | Recipe (below) |
|---|---|---|
| Top chrome (trip header + segmented controls + day strip, as one bar) | `TripHeader.tsx` + controls area in `PlanClient.tsx` | `.lg-bar` |
| Bottom tab bar → becomes a **floating pill**, detached 14px from edges, 24px from bottom | `BottomTabBar.tsx` | `.lg-glass` + sliding pill |
| FAB | `HomeClient.tsx` | `.lg-glass-tint` (orange) |
| Bottom sheets (place detail, journal editor) | `PlaceDetailSheet.tsx`, journal editor | `.lg-glass`, radius 26, inset 8px from edges |
| Map overlay controls, day-filter chips, **map markers + time chips** | map view components | `.lg-glass` |
| Primary buttons that float over content (Add place) | itinerary footer | `.lg-glass-tint` |
| Segmented control active thumb | all segmented controls | `.lg-glass` mini-plate |

The bottom tab bar is the biggest structural change: from full-width bar to floating pill (`left/right: 14px; bottom: 24px; border-radius: 999px`). Content scrolls underneath it (add ~150px bottom padding to scrollers).

## 2. Glass recipes (final, user-approved values)

CSS custom properties (put on a root wrapper):

```css
--lg-blur: 4px;      /* user-tuned: crisp, NOT heavily frosted */
--lg-tint: 0.5;      /* white tint opacity */
--lg-sat: 1.85;      /* backdrop saturation boost = "refraction" pop */
```

> The low blur (4px) is deliberate and user-chosen — the glass should read as thin, clear glass with strong color refraction (high saturate), not iOS-7-style heavy frost. Don't "fix" it upward.

### `.lg-glass` — core plate (pills, chips, sheets, markers, buttons)

```css
.lg-glass {
  position: relative;
  background: linear-gradient(155deg,
    rgba(255,255,255, calc(var(--lg-tint) + 0.22)) 0%,
    rgba(255,255,255, calc(var(--lg-tint) - 0.06)) 48%,
    rgba(255,255,255, calc(var(--lg-tint) + 0.10)) 100%);
  -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  box-shadow:
    0 10px 30px rgba(27,31,28,0.14),          /* lift */
    inset 0 1px 0 rgba(255,255,255,0.95),     /* top specular edge */
    inset 1px 0 0 rgba(255,255,255,0.45),     /* left edge catch */
    inset 0 -1px 0 rgba(255,255,255,0.18);    /* bottom edge */
  border: 0.5px solid rgba(255,255,255,0.65);
}
/* corner specular bloom */
.lg-glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background:
    radial-gradient(120% 70% at 18% -18%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%),
    radial-gradient(90% 50% at 86% 112%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 50%);
}
```

### `.lg-bar` — top chrome (square, fades down, no lift shadow)

```css
.lg-bar {
  background: linear-gradient(180deg,
    rgba(255,255,255, calc(var(--lg-tint) + 0.30)) 0%,
    rgba(255,255,255, calc(var(--lg-tint) - 0.10)) 100%);
  -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  box-shadow: inset 0 -0.5px 0 rgba(27,31,28,0.10);
}
```

### `.lg-glass-tint` — colored glass (FAB, primary CTAs)

Apply over a translucent brand color (`background: rgba(224,80,44,0.85)` orange / `rgba(51,103,122,0.85)` teal):

```css
.lg-glass-tint {
  -webkit-backdrop-filter: blur(calc(var(--lg-blur) * 0.7)) saturate(var(--lg-sat));
  backdrop-filter: blur(calc(var(--lg-blur) * 0.7)) saturate(var(--lg-sat));
  border: 0.5px solid rgba(255,255,255,0.5);
  box-shadow:
    0 10px 26px rgba(27,31,28,0.22),
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 -1px 0 rgba(0,0,0,0.08);
}
```

### Fallback (no backdrop-filter support)

```css
@supports not (backdrop-filter: blur(1px)) {
  .lg-glass, .lg-bar { background: rgba(255,255,255,0.92); }
  .lg-glass-tint { /* keep the solid rgba color, just no blur */ }
}
```

## 3. Motion system

All entrances are **JS-triggered CSS transitions** (never bare keyframe animations — see pitfalls §4). Shared pattern: render with a `.lg-pre` class (hidden offset state), remove it one double-`requestAnimationFrame` after mount; stagger via inline `transition-delay: i * 45ms`.

Spring curve used everywhere: `cubic-bezier(0.34, 1.4, 0.64, 1)` (slight overshoot). Decorative loops (dash crawl, shimmer, FAB pulse) are the only keyframe animations, and their frame-0 state is benign.

| # | Effect | Where | Spec |
|---|---|---|---|
| 1 | Staggered list entrance | itinerary blocks on mount & on day change | translateY(18px)→0 + fade; 520ms spring / 380ms ease; delay i×45ms |
| 2 | Header compress on scroll | top chrome, `scrollTop > 30` | title `scale(0.86)` origin left (320ms), date opacity→0.6, bar gains `0 12px 30px rgba(27,31,28,0.14)` shadow |
| 3 | Tab-bar liquid pill | floating tab bar | absolute pill behind icons; `left` 420ms spring; while moving: `scaleX(1.14) scaleY(0.86)` for 250ms (gooey squish); icon/label `color` 260ms |
| 4 | Day-strip ink pill | day chips | same sliding-pill pattern, 380ms spring; chip text `color` 300ms; pill slides UNDER neighboring glass chips (see §4 stacking) |
| 5 | Map pin drop-in | markers on map mount | translateY(-14px) scale(0.55)→1 + fade; 480ms `cubic-bezier(0.34,1.55,0.64,1)`; delay i×55ms |
| 6 | Route dash crawl | map polylines (3px dotted, `stroke-dasharray: 1 7`) | `stroke-dashoffset` to −16, 1.4s linear infinite |
| 7 | Specular sweep | tab bar (only) | 46%-wide white gradient strip, skew −16°, sweeps left→right; 5.4s cycle, idle 62% of it |
| 8 | FAB breathing | FAB | box-shadow pulses to `0 14px 36px rgba(224,80,44,0.5)` at 50%; 2.6s ease-in-out infinite |
| 9 | View cross-fade | List↔Map↔tab switches | container opacity 300ms + `scale(0.985)`→1 420ms spring |
| 10 | Press feedback | every tappable glass element | `:active { transform: scale(0.94); filter: brightness(1.06); }` released via 240ms spring |
| 11 | Sheet entrance | bottom sheets | translateY(46px)+fade in, 380ms `cubic-bezier(0.34,1.3,0.64,1)`; backdrop `rgba(27,31,28,0.30)` fades 240ms |

Reduced motion: wrap ALL of the above —

```css
@media (prefers-reduced-motion: reduce) {
  /* loops off, entrances render at final state, transitions none */
}
```

## 4. Implementation pitfalls (we hit both — don't repeat)

1. **Never use keyframe entrance animations on chrome.** In throttled/background tabs (and some webviews) a running animation can sit at frame 0 forever; with a hidden `from` state the element is simply invisible. Always: base style = fully visible final state; entrance = transition triggered by removing a `.lg-pre` class one double-rAF after mount.
2. **`backdrop-filter` creates a stacking context.** A child of a glass element can never `z-index` itself above a sibling of that glass element. For the sliding-pill patterns: pill `z-index: 1`, whole chips `z-index: 2`, and the ACTIVE chip drops its `.lg-glass` class (the pill IS its background). Side effect kept on purpose: the pill submerges under neighboring glass chips while sliding.
3. Performance: animate only `transform`, `opacity`, `box-shadow`, `color`. The glass itself is static CSS — no per-frame JS anywhere. On low-end Android, optionally halve `--lg-blur` or use the `@supports` fallback.

## 5. Suggested implementation order

1. Drop in the CSS vars + `.lg-glass/.lg-bar/.lg-glass-tint/.lg-press` recipes (global stylesheet).
2. `BottomTabBar.tsx` → floating pill + sliding active pill (#3) + shimmer (#7). Add bottom padding to page scrollers.
3. Top chrome → `.lg-bar` + compress-on-scroll (#2).
4. Day strip pill (#4), segmented thumbs.
5. Map markers/controls glass + pin drop-in (#5) + dash crawl (#6).
6. Sheets (#11), FAB (#8), list stagger (#1), view fades (#9), press states (#10).
7. `@supports` fallback + reduced-motion block.

## 6. Files in this bundle

- `LIQUID_GLASS_MOTION.md` — this document
- `demo/BurgerGo Liquid Glass.html` — interactive reference (needs the sibling folders below)
- `demo/liquid/lg-styles.css` — **the canonical CSS** (recipes + all motion classes, copy-ready)
- `demo/liquid/lg-screens.jsx` — reference implementation of the patterns (sliding pills, useEnter hook, stagger wiring)
- `demo/ios-frame.jsx`, `demo/tweaks-panel.jsx`, `demo/redesign/shared.jsx`, `demo/assets/` — demo scaffolding (ignore for implementation)
