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
export const springy = (v: Animated.Value, toValue: number) =>
  Animated.spring(v, { toValue, friction: 7, tension: 80, useNativeDriver: true });

/**
 * Entrance: animated {opacity, translateY} running pre→final after mount
 * (+delay). Animates on EVERY mount — consumers that re-enter per key get a
 * fresh Animated.Value via the remount. Reduce-motion is read directly inside
 * the mount effect (not via useReduceMotion, whose first render is always
 * `false` while the async query resolves — that stale value must never decide
 * whether to animate).
 */
export function useEnter(delayMs = 0, fromY = 18) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        v.setValue(1); // jump straight to the final state
        return;
      }
      timer = setTimeout(() => springy(v, 1).start(), delayMs);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Mount-only by design: replay = remount (key change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) }],
  };
}

/**
 * View cross-fade (handoff #9): opacity 0→1 (300ms timing) + scale 0.985→1
 * spring, re-run whenever `key` changes. Skips the initial mount (content
 * starts fully visible — only switches animate), so the wrapped view never
 * has a hidden frame-0 (handoff pitfall #1). Reduce-motion: snap to final.
 */
export function useCrossFade(key: unknown) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    let cancelled = false;
    opacity.setValue(0);
    scale.setValue(0.985);
    const snap = () => {
      opacity.setValue(1);
      scale.setValue(1);
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) return snap();
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          springy(scale, 1),
        ]).start();
      })
      .catch(snap);
    return () => {
      cancelled = true;
    };
    // Re-run on the switch key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { opacity, transform: [{ scale }] };
}

/** Press feedback: scale 0.94 down, springy release (handoff #10). */
export function usePressScale() {
  const v = useRef(new Animated.Value(1)).current;
  return {
    style: { transform: [{ scale: v }] },
    onPressIn: () =>
      Animated.timing(v, { toValue: 0.94, duration: 90, useNativeDriver: true }).start(),
    onPressOut: () => springy(v, 1).start(),
  };
}
