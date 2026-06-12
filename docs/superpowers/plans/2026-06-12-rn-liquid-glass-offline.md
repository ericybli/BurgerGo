# expo-rn Liquid Glass + Offline Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three things in the expo-rn app: a global green/red data-source dot, a "Clear offline data" control, and the Liquid Glass visual/motion port from the design handoff — with zero functional changes.

**Architecture:** New tiny pub/sub (`lib/dataSource.ts`) fed by `getJson`; Settings reuses existing `clear*Cache()` primitives; glass = shared `<GlassPlate>` primitives (expo-blur + expo-linear-gradient) consumed by chrome components (tab bar, headers, sheets, FAB); motion = core `Animated` hooks in `components/ui/motion.ts`; the WebView map gets the handoff's original CSS injected.

**Tech Stack:** Expo SDK 54, core Animated (NO reanimated), expo-blur, expo-linear-gradient.

**Spec:** `docs/superpowers/specs/2026-06-12-rn-liquid-glass-offline-design.md`
**Canonical visual reference (IN REPO):** `expo-rn/docs/handoff/liquid-glass/LIQUID_GLASS_MOTION.md` + `lg-styles.css` — read BOTH before any visual task.

---

## Ground rules (every task)

- Work in `/Users/eric/own/BurgerGo/expo-rn` on branch `feature/rn-liquid-glass` (create from master in Task 1).
- Gates per task: `npm run typecheck` (NEVER bare `npx tsc` — stack overflow) and, for tasks marked [export-gate], `npx expo export --platform ios`. Final task runs web export too.
- expo-rn has NO test runner — "verify" = typecheck + export + the controller's visual pass on `npm run web`.
- NEVER bare `fontWeight` (use `font.*`), no `Alert.alert`, tokens from `lib/theme.ts`, no functional/behavioral changes in glass tasks (props, handlers, navigation untouched).
- Animate ONLY transform/opacity/shadow/color. All loops must respect the reduce-motion hook (Task 3).
- Commit per task with the message given.

---

### Task 1: Data-source dot

**Files:**
- Create: `expo-rn/lib/dataSource.ts`
- Create: `expo-rn/components/DataSourceDot.tsx`
- Modify: `expo-rn/lib/api/client.ts` (report from getJson), `expo-rn/lib/theme.ts` (success token), `expo-rn/App.tsx` (mount)

- [ ] **Step 1: Branch** — `cd /Users/eric/own/BurgerGo && git checkout -b feature/rn-liquid-glass`

- [ ] **Step 2: `lib/dataSource.ts`**

```ts
/**
 * Where the data on screen came from. `getJson` reports 'live' on every
 * network success and 'cache' whenever it serves the offline fallback; the
 * dot renders red for 'cache' (and whenever the device is offline).
 */
type Source = 'live' | 'cache';
type Listener = (s: Source) => void;

let current: Source = 'live';
const listeners = new Set<Listener>();

export function reportDataSource(s: Source): void {
  if (s === current) return;
  current = s;
  for (const l of listeners) l(s);
}

export function getDataSource(): Source {
  return current;
}

export function subscribeDataSource(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
```

- [ ] **Step 3: report from `lib/api/client.ts#getJson`** — inside the existing try: after `const data = (await res.json()) as T;` add `reportDataSource('live');`; inside the catch, after a cache HIT (`if (hit)`) add `reportDataSource('cache');` before returning. Import from `../dataSource`. NO other client changes.

- [ ] **Step 4: theme token** — in `lib/theme.ts` colors, add `success: '#2E9E5B',` next to `danger` (match the object's comment style).

- [ ] **Step 5: `components/DataSourceDot.tsx`**

```tsx
/**
 * Global data-source indicator: 8px dot, top-right safe area, every screen.
 * Green = live server data; red = cached/offline data. Tap → 3s glass label
 * with the offline-download timestamp when showing cached data.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDataSource, subscribeDataSource } from '../lib/dataSource';
import { getOfflineMeta } from '../lib/offlineStore';
import { useOnline } from '../lib/online';
import { colors, font, radius } from '../lib/theme';

export function DataSourceDot() {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [source, setSource] = useState(getDataSource());
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => subscribeDataSource(setSource), []);

  const cached = !online || source === 'cache';

  async function showLabel() {
    if (cached) {
      const meta = await getOfflineMeta();
      const when = meta
        ? ` — downloaded ${new Date(meta.ts).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
        : '';
      setLabel(`Offline data${when}`);
    } else {
      setLabel('Live data');
    }
    setTimeout(() => setLabel(null), 3000);
  }

  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: insets.top + 10 }]}>
      {label ? (
        <View style={s.labelPill}>
          <Text style={s.labelText}>{label}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cached ? 'Showing offline data' : 'Showing live data'}
        hitSlop={10}
        onPress={() => void showLabel()}
        style={[s.dot, { backgroundColor: cached ? colors.danger : colors.success }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  labelPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelText: { fontSize: 11, fontFamily: font.medium, color: colors.ink },
});
```
(`radius.chip` — confirm the token name in lib/theme.ts; if it's named differently use the chip radius the kit Chip uses. In Task 3 this pill becomes a GlassPlate — leave a `// glass in Task 3` comment.)

- [ ] **Step 6: mount in App.tsx** — inside the authenticated `<View style={{flex:1,…}}>` wrapper, render `<DataSourceDot />` AFTER `<NavigationContainer>` (sibling, so it floats above all screens). Do NOT mount it on the LoginScreen branch.

- [ ] **Step 7: Gate + commit** — `npm run typecheck`; then `cd .. && git add expo-rn && git commit -m "feat(expo-rn): global data-source dot (live vs cached)"`

---

### Task 2: Clear offline data

**Files:**
- Modify: `expo-rn/screens/settings/SettingsScreen.tsx` (Offline card)

- [ ] **Step 1:** Read the Offline card block (Card 5) fully. Add state `clearArmed` + the house two-tap pattern (3s auto-disarm — copy ManageTripSheet's `deleteArmed` idiom exactly), and a handler:

```ts
async function handleClearOffline() {
  if (!clearArmed) {
    setClearArmed(true);
    return;
  }
  setClearArmed(false);
  setOfflineBusy(true); // reuse the card's existing busy flag name — read the file
  try {
    await clearJsonCache();
    await clearPhotoCache();
    await setOfflineMeta(null);
    setOfflineMetaState(null); // reuse the card's existing meta state setter name
  } finally {
    setOfflineBusy(false);
  }
}
```
(Adapt the two state names marked "reuse" to the file's actual names. Import `clearJsonCache, clearPhotoCache, setOfflineMeta` from `../../lib/offlineStore` — `getOfflineMeta` is already imported there.)

- [ ] **Step 2: UI** — below the existing Download/Refresh button + meta line, render ONLY when meta exists: a ghost/danger text button (match ProfileCard's sign-out two-tap visual): title `clearArmed ? 'Sure? Clear offline data' : 'Clear offline data'`, danger color, disabled while the download is running. After clearing, the card shows the pristine "Download for offline" state (meta line gone — follows from meta state = null).

- [ ] **Step 3: Gate + commit** — `npm run typecheck`; `cd .. && git add expo-rn && git commit -m "feat(expo-rn): clear offline data (two-tap) in Settings"`

---

### Task 3: Deps + glass primitives + motion utils  [export-gate]

**Files:**
- Modify: `expo-rn/package.json` (via expo install)
- Create: `expo-rn/components/ui/glass.tsx`
- Create: `expo-rn/components/ui/motion.ts`
- Modify: `expo-rn/components/DataSourceDot.tsx` (label pill → GlassPlate)

- [ ] **Step 1: Install** — `cd /Users/eric/own/BurgerGo/expo-rn && npx expo install expo-blur expo-linear-gradient`

- [ ] **Step 2: `components/ui/glass.tsx`** — the ONLY place glass styling lives. Read `docs/handoff/liquid-glass/lg-styles.css` first; this translates `.lg-glass` / `.lg-bar` / `.lg-glass-tint`:

```tsx
/**
 * Liquid-glass primitives (handoff: docs/handoff/liquid-glass/). RN approximation:
 * BlurView ≈ backdrop-filter blur(4px) (no saturate() on RN — accepted),
 * a white linear-gradient overlay ≈ the tint gradient, plus specular edges.
 * Content is never glass; chrome is always glass.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/** blur(4px) ≈ intensity 20 on iOS BlurView (user-tuned: thin clear glass, not frost). */
const BLUR_INTENSITY = 20;
const TINT = 0.5; // --lg-tint

/** Core plate: pills, chips, sheets, buttons. Wrap content; pass borderRadius via style. */
export function GlassPlate({
  children,
  style,
  radius = 18,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  return (
    <View style={[s.plate, { borderRadius: radius }, style]}>
      <BlurView intensity={BLUR_INTENSITY} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      <LinearGradient
        // .lg-glass gradient: 155° ≈ start top-left → end bottom-right
        colors={[
          `rgba(255,255,255,${TINT + 0.22})`,
          `rgba(255,255,255,${TINT - 0.06})`,
          `rgba(255,255,255,${TINT + 0.1})`,
        ]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View style={[StyleSheet.absoluteFill, s.specular, { borderRadius: radius }]} />
      <View style={s.content}>{children}</View>
    </View>
  );
}

/** Colored glass (FAB, floating CTAs): translucent brand color over light blur. */
export function GlassTintPlate({
  children,
  style,
  radius = 999,
  color = 'rgba(224,80,44,0.85)', // orange; teal = rgba(51,103,122,0.85)
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  color?: string;
}) {
  return (
    <View style={[s.tintPlate, { borderRadius: radius }, style]}>
      <BlurView intensity={BLUR_INTENSITY * 0.7} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: color }]} />
      <View style={s.content}>{children}</View>
    </View>
  );
}

/** Top chrome: square, fades down, inset hairline instead of lift shadow (.lg-bar). */
export function GlassBar({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.bar, style]}>
      <BlurView intensity={BLUR_INTENSITY} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[`rgba(255,255,255,${TINT + 0.3})`, `rgba(255,255,255,${TINT - 0.1})`]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.content}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  plate: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: 'rgb(27,31,28)',
    shadowOpacity: 0.14,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tintPlate: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: 'rgb(27,31,28)',
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  bar: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(27,31,28,0.10)',
  },
  // corner specular bloom approximation (::before radial gradients)
  specular: {
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderTopColor: 'rgba(255,255,255,0.95)',
  },
  content: { position: 'relative' },
});
```
NOTE iOS shadow + `overflow:'hidden'` conflict: shadows don't render on views with overflow hidden — restructure if needed (outer shadow View wrapping an inner overflow-hidden View). Verify on web/device and fix within this task; the exported component API must stay `GlassPlate/GlassTintPlate/GlassBar` as above.

- [ ] **Step 3: `components/ui/motion.ts`**

```ts
/**
 * Motion system (handoff §3). Core Animated only; every entrance is a
 * transition from a pre-state triggered after mount (never a keyframe with a
 * hidden frame-0 — handoff pitfall #1). All consumers must check
 * useReduceMotion() and render the final state directly when true.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Spring matching cubic-bezier(0.34,1.4,0.64,1): slight overshoot. */
export const springy = (v: Animated.Value | Animated.ValueXY, toValue: number | { x: number; y: number }) =>
  Animated.spring(v, { toValue: toValue as never, friction: 7, tension: 80, useNativeDriver: true });

/** Entrance: returns animated style {opacity, translateY} running pre→final after mount (+delay). */
export function useEnter(delayMs = 0, fromY = 18) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const t = setTimeout(() => springy(v, 1).start(), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) }],
  };
}

/** Press feedback: scale 0.94 down, springy release (handoff #10). */
export function usePressScale() {
  const v = useRef(new Animated.Value(1)).current;
  return {
    style: { transform: [{ scale: v }] },
    onPressIn: () => Animated.timing(v, { toValue: 0.94, duration: 90, useNativeDriver: true }).start(),
    onPressOut: () => springy(v, 1).start(),
  };
}
```

- [ ] **Step 4:** DataSourceDot's label pill: replace the white View with `<GlassPlate radius={999} style={{paddingHorizontal:10, paddingVertical:4}}>`.

- [ ] **Step 5: Gates + commit** — `npm run typecheck && npx expo export --platform ios`; commit `"feat(expo-rn): glass + motion primitives (expo-blur, linear-gradient)"`

---

### Task 4: Floating glass tab bar  [export-gate]

**Files:**
- Create: `expo-rn/navigation/GlassTabBar.tsx`
- Modify: `expo-rn/navigation/TripTabs.tsx` (pass `tabBar` prop; keep all screens/options)
- Modify: screens' scroll padding (see Step 3)

- [ ] **Step 1: `GlassTabBar.tsx`** — a `BottomTabBarProps` custom bar (handoff #3 + #7):
  - Container: absolute, `left/right: 14`, `bottom: Math.max(insets.bottom, 10) + 14`, height 62, `<GlassPlate radius={999}>`.
  - 6 equal flex slots; each renders the route's existing `tabBarIcon` (call `options.tabBarIcon({focused, color, size:21})`) + label Text (font.semibold 10, color animates active `colors.accent` / inactive `colors.faint` — color isn't native-driver animatable; use two stacked Texts cross-fading opacity, or just snap color (acceptable)).
  - Sliding active pill: Animated.View width = barWidth/6 (measure via onLayout), `left` spring 420ms (`springy`), squish while moving: scaleX 1.14 / scaleY 0.86 for 250ms then spring back. Pill style: white rgba(255,255,255,0.8), radius 999, inset vertical 7 — sits BEHIND the slot content (zIndex 1 vs 2; per handoff pitfall #2 keep the pill a sibling, not a child of glass).
  - Shimmer (#7): a 46%-wide LinearGradient strip (transparent→white 0.35→transparent), skewX −16°, Animated translateX loop across the bar: 5.4s cycle with idle (use Animated.loop(sequence[timing(move 2s), delay(3.4s)])). Skip entirely when `useReduceMotion()`.
  - `onPress` per slot: copy react-navigation's standard custom-tabBar pattern (`navigation.emit({type:'tabPress'...})` + `navigation.navigate(route.name)`); preserve accessibility (`accessibilityRole="tab"`, selected state).
- [ ] **Step 2:** `TripTabs.tsx`: add `tabBar={(props) => <GlassTabBar {...props} />}` and REMOVE the old `tabBarStyle` block (keep label/icon options — the custom bar reads them).
- [ ] **Step 3: bottom padding sweep** — the bar now floats over content. For each tab screen's main scroller (Plan list, Eats list, Tickets, Budget, Todo, Journal): bottom content padding becomes ~150 (`contentContainerStyle.paddingBottom`). Grep `paddingBottom` in `screens/*/`*Screen* and the kit `Screen` component (components/ui/index.tsx `scrollContent.paddingBottom: 40`) — bump the kit default to 150 ONLY for screens inside the tab navigator: add an optional `bottomInset?: number` prop to `Screen` defaulting to 40, pass 150 from the six tab screens. The map view (PlanMap) keeps its own controls clear of `bottom: 100` — check map control offsets and bump if they'd collide with the floating bar.
- [ ] **Step 4: Gates + commit** — typecheck + ios export; commit `"feat(expo-rn): floating liquid-glass tab bar with sliding pill + shimmer"`

---

### Task 5: Glass headers (static — no compress)  [export-gate]

**Files:**
- Modify: `expo-rn/App.tsx` (Trip + Settings stack screens), `expo-rn/screens/home/HomeScreen.tsx` (in-page header)

- [ ] **Step 1:** Trip + Settings native-stack screens: add `headerTransparent: true`, `headerBackground: () => <GlassBar style={StyleSheet.absoluteFill} />` to their options (keep all existing title/right config). Each affected screen's content needs top padding = header height (`useHeaderHeight()` from `@react-navigation/elements` — confirm it's available via @react-navigation/native-stack deps; otherwise use insets.top + 44). Apply to TripTabs screens (they render under the Trip header) and SettingsScreen scroller.
- [ ] **Step 2:** Home in-page header: wrap the existing logo row in `<GlassBar>` only if content scrolls beneath it (Home header currently scrolls WITH content — in that case leave it; verify by reading HomeScreen and do nothing if it's in-flow). Note the decision in the commit body.
- [ ] **Step 3: Gates + commit** — typecheck + ios export; commit `"feat(expo-rn): glass top chrome (static)"`

---

### Task 6: Sheets + kit press feedback  [export-gate]

**Files:**
- Modify: `expo-rn/components/ui/index.tsx` (Sheet, SheetPanel, Button, IconButton, Chip)

- [ ] **Step 1: Sheet entrance (#11)** — `Sheet` switches `animationType="slide"` → `"none"` and animates itself: backdrop `rgba(27,31,28,0.30)` opacity 240ms; panel translateY(46)+fade with overshoot spring on mount (useEnter pattern with fromY 46); reverse on close before calling onClose? NO — keep close behavior identical (instant dismiss is current behavior via Modal; do not add exit animation logic that delays onClose — zero functional change).
- [ ] **Step 2: SheetPanel glass** — panel background becomes `<GlassPlate radius={26}>` with 8px horizontal inset (`marginHorizontal: 8, marginBottom: 8`), keeping the drag handle + title. CAUTION: sheets host TextInputs over scrolling content; if the blur causes readability issues on dense sheets, increase the gradient tint by +0.15 for sheets only (a `strength="sheet"` prop on GlassPlate).
- [ ] **Step 3: Press feedback (#10)** — Button, IconButton, Chip (and PillButton in `screens/home/ManageTripSheet.tsx`): wrap the pressable content in `Animated.View` using `usePressScale()`; keep every existing prop/handler. (Pressables already have pressed-state styles — keep those too; scale adds on top.)
- [ ] **Step 4: Gates + commit** — typecheck + ios export; commit `"feat(expo-rn): glass sheets + universal press-scale feedback"`

---

### Task 7: Day strip pill + list stagger + view cross-fade  [export-gate]

**Files:**
- Modify: `expo-rn/screens/plan/DayStrip.tsx`, `expo-rn/screens/plan/DayItinerary.tsx` (or wherever the day list rows render — read PlanScreen first), `expo-rn/screens/plan/PlanScreen.tsx` (List↔Map switch)

- [ ] **Step 1: Day strip (#4)** — sliding ink pill behind the active chip: measure chip x/width via onLayout map, Animated.View (ink bg, radius 999) springs `left`/`width` 380ms; active chip text color flips to white (current active style) — keep ALL selection logic.
- [ ] **Step 2: List stagger (#1)** — itinerary rows (place cards + leg connectors) on mount AND when the selected day changes: each row wrapped in `Animated.View` with `useEnter(i * 45, 18)`; key the wrapper by `dayDate` so day switches re-run it; cap delay at i≤12 (`Math.min(i,12)*45`).
- [ ] **Step 3: View cross-fade (#9)** — the List↔Map segmented switch in PlanScreen: wrap the view container in Animated opacity 300ms + scale 0.985→1 spring, re-triggered on view change (key by view mode). Map stays MOUNTED if it currently stays mounted (check `PlanMap.native` persistence comments — do NOT change mount behavior, only opacity/scale of the wrapper).
- [ ] **Step 4: Gates + commit** — typecheck + ios export; commit `"feat(expo-rn): day-strip pill, itinerary stagger, view cross-fade"`

---

### Task 8: FAB  [export-gate]

**Files:**
- Modify: `expo-rn/screens/home/HomeScreen.tsx` (FAB at ~line 249, styles ~326)

- [ ] **Step 1:** FAB becomes `<GlassTintPlate radius={999}>` (orange) keeping size/position/onPress; breathing (#8): Animated loop scale 1→1.04→1 + shadowOpacity pulse, 2.6s ease-in-out, skipped under reduce-motion; keep the pressed scale style (compose with usePressScale).
- [ ] **Step 2: Gates + commit** — typecheck + ios export; commit `"feat(expo-rn): glass FAB with breathing pulse"`

---

### Task 9: WebView map — original handoff CSS  [export-gate]

**Files:**
- Modify: `expo-rn/screens/plan/map/webviewMapHtml.ts` (the `<style>` block at ~line 49 + marker cssText builders), possibly `markerDom`/route-drawing code in the same file

- [ ] **Step 1:** Read `docs/handoff/liquid-glass/lg-styles.css`. Into the HTML's `<style>`: add the CSS custom props (`--lg-blur:4px; --lg-tint:0.5; --lg-sat:1.85`), `.lg-glass` (FULL recipe incl. ::before bloom), the `@supports` fallback, and the motion bits used here: pin drop-in (#5: entrance via `.lg-pre` + transition translateY(-14px) scale(0.55)→1, 480ms cubic-bezier(0.34,1.55,0.64,1), stagger i×55ms — JS adds/removes the class double-rAF after marker insert) and dash crawl (#6).
- [ ] **Step 2:** Markers + time chips get `class="lg-glass"` (keep all existing inline cssText for layout; glass replaces only background/border/shadow — remove the now-conflicting background/box-shadow declarations from cssText).
- [ ] **Step 3:** Route polylines (#6): currently solid (memory: "solid route lines" was a deliberate 2026-06-09 choice — the handoff overrides it BY DESIGN since this is the new design language): Google Maps JS polylines can't stroke-dash via CSS; implement the dotted crawl with the Maps API icons pattern (`icons: [{icon: {path: CIRCLE, scale: 1.5}, repeat: '10px', offset}]` + a setInterval ticking `offset` ~60ms — JS, not CSS; keep it OFF under prefers-reduced-motion media check via matchMedia). If the perf on device is poor, keep static dotted (no crawl) — note the choice.
- [ ] **Step 4:** Map overlay controls/chips drawn in RN (MapChrome/DayLegend/LegChip etc. in `screens/plan/map/`) — give their floating containers `GlassPlate` treatment (read each small component; visual only).
- [ ] **Step 5: Gates + commit** — typecheck + ios export; commit `"feat(expo-rn): liquid-glass map — glass markers/chips, pin drop-in, route dash crawl"`

---

### Task 10: Final gates + visual pass + docs

- [ ] **Step 1:** `npm run typecheck` + `npx expo export --platform ios` + `npx expo export --platform web`.
- [ ] **Step 2 (controller, not subagent):** `npm run web` + browser screenshots: Home (FAB, dot), Trip Plan list (stagger, day pill, tab bar), Map (glass markers), a sheet, Settings (clear button). Compare against `demo/BurgerGo Liquid Glass.html` side by side.
- [ ] **Step 3:** Update `expo-rn/docs/` with a one-page `liquid-glass-port.md`: what was ported/simplified/skipped (from the spec table) + the RN approximation notes. Commit `"docs(expo-rn): liquid-glass port notes"`.
- [ ] **Step 4:** Merge to master, `eas build -p ios --profile preview --non-interactive`, hand the install link to Eric.

## Self-review

- Spec coverage: dot (T1), clear (T2), glass primitives (T3), 11 effects → T4(#3,#7) T5(#2-static) T6(#10,#11) T7(#1,#4,#9) T8(#8) T9(#5,#6) reduce-motion (T3 hook, consumed everywhere); build (T10). ✓
- No reanimated anywhere; no functional changes in T4–T9 beyond padding/visuals. ✓
- Type consistency: `GlassPlate/GlassTintPlate/GlassBar`, `useEnter/usePressScale/useReduceMotion/springy` used consistently across tasks. ✓
