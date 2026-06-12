/**
 * Liquid-glass primitives (handoff: docs/handoff/liquid-glass/). RN approximation:
 * BlurView ≈ backdrop-filter blur(4px) (no saturate() on RN — accepted),
 * a white linear-gradient overlay ≈ the tint gradient, plus specular edges.
 * Content is never glass; chrome is always glass.
 *
 * iOS shadow vs overflow:hidden (CRITICAL — later tasks inherit this):
 * iOS drops shadows on overflow-hidden views, so every plate is TWO views —
 * an OUTER View carrying the lift shadow + borderRadius (never overflow) and
 * an INNER View carrying overflow:'hidden' + borderRadius + the blur/gradient/
 * border layers, with children inside the inner. The `style` prop is split:
 * placement/sizing keys (position, margins, flex, width…) go to the outer so
 * the shadow box moves with the plate; everything else (padding, alignment…)
 * goes to the inner so the glass still fills edge-to-edge behind the content.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/** blur(4px) ≈ intensity 20 on iOS BlurView (user-tuned: thin clear glass, not frost). */
const BLUR_INTENSITY = 20;
const TINT = 0.5; // --lg-tint

const white = (alpha: number) => `rgba(255,255,255,${Math.min(1, Math.max(0, alpha)).toFixed(2)})`;

/** Style keys that must live on the OUTER (shadow) view: placement + sizing. */
const OUTER_KEYS = new Set([
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'aspectRatio',
  'zIndex',
  'transform',
  'opacity',
  'display',
]);

function splitStyle(style?: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: ViewStyle = {};
  const inner: ViewStyle = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    ((OUTER_KEYS.has(key) ? outer : inner) as Record<string, unknown>)[key] = value;
  }
  return { outer, inner };
}

/** Core plate: pills, chips, sheets, buttons. Wrap content; pass borderRadius via `radius`. */
export function GlassPlate({
  children,
  style,
  radius = 18,
  strength = 'chrome',
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** 'sheet' = +0.15 tint for dense content readability (forms over scrollers). */
  strength?: 'chrome' | 'sheet';
}) {
  const { outer, inner } = splitStyle(style);
  const boost = strength === 'sheet' ? 0.15 : 0;
  return (
    // OUTER: shadow + radius, NO overflow (iOS drops shadows on clipped views).
    <View style={[s.plateShadow, { borderRadius: radius }, outer]}>
      {/* INNER: clips the glass layers (and children) to the radius. */}
      <View style={[s.clip, { borderRadius: radius }, inner]}>
        <BlurView intensity={BLUR_INTENSITY} tint="light" style={s2.glaze} />
        <LinearGradient
          colors={[white(TINT + 0.22 + boost), white(TINT - 0.06 + boost), white(TINT + 0.1 + boost)]}
          locations={[0, 0.48, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={s2.glaze}
        />
        {children}
        <View pointerEvents="none" style={[s.plateEdge, { borderRadius: radius }]} />
      </View>
    </View>
  );
}

/** Colored glass (FAB, floating primary CTAs): blur + translucent brand fill. */
export function GlassTintPlate({
  children,
  style,
  radius = 999,
  color = 'rgba(224,80,44,0.85)',
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Translucent brand fill; teal alt = 'rgba(51,103,122,0.85)'. */
  color?: string;
}) {
  const { outer, inner } = splitStyle(style);
  return (
    <View style={[s.tintShadow, { borderRadius: radius }, outer]}>
      <View style={[s.clip, { borderRadius: radius }, inner]}>
        <BlurView intensity={BLUR_INTENSITY * 0.7} tint="light" style={s2.glaze} />
        <View style={[s2.glaze, { backgroundColor: color }]} />
        {children}
        <View pointerEvents="none" style={[s.tintEdge, { borderRadius: radius }]} />
      </View>
    </View>
  );
}

/** Top chrome bar: square, vertical fade, bottom inset hairline, NO lift shadow. */
export function GlassBar({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // No shadow → single overflow-hidden view is fine.
  return (
    <View style={[s.bar, style]}>
      <BlurView intensity={BLUR_INTENSITY} tint="light" style={s2.glaze} />
      <LinearGradient
        colors={[white(TINT + 0.3), white(TINT - 0.1)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s2.glaze}
      />
      {children}
      <View pointerEvents="none" style={s.barHairline} />
    </View>
  );
}

const s = StyleSheet.create({
  // 0 10px 30px rgba(27,31,28,0.14) lift. Android: elevation only (gradient
  // fallback look accepted; do NOT enable experimentalBlurMethod on BlurView).
  plateShadow: {
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.14,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // 0 10px 26px rgba(27,31,28,0.22).
  tintShadow: {
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  clip: {
    overflow: 'hidden',
    zIndex: 0,
    // When sizing keys (height/width) land on the OUTER via splitStyle, the
    // inner must stretch to fill it — otherwise the glass layers hug the
    // content (a 20px icon inside a 40px button left the bottom half unglazed
    // and the icon top-pinned). flexGrow is inert when the outer is
    // content-sized, so auto-sized plates (label pills, sheets) are unaffected.
    flexGrow: 1,
  },
  // Hairline frame with brighter top edge = the specular catch from the CSS
  // inset shadows. Drawn over children so the edge reads even at the rim.
  plateEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    borderTopColor: 'rgba(255,255,255,0.95)',
  },
  tintEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  bar: {
    overflow: 'hidden',
    zIndex: 0,
  },
  barHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(27,31,28,0.10)',
  },
});

// Glaze layers sit BELOW children: on web, absolutely-positioned siblings
// otherwise paint above static children (CSS paint order), hiding icons/text.
// zIndex -1 needs the parent (clip/bar, zIndex 0) to be a stacking context.
const s2 = StyleSheet.create({
  glaze: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
});
