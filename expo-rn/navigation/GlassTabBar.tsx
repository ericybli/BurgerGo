/**
 * Floating liquid-glass tab bar (handoff §1: the signature structural change —
 * full-width bar → glass pill detached 14px from the edges). Navigation
 * behavior is byte-identical to the stock bar: icons/labels come from each
 * route's `options`, presses emit tabPress/tabLongPress through react-
 * navigation. Motion: sliding active pill with gooey squish (#3) + occasional
 * specular sweep (#7); both honor reduce-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassPlate } from '../components/ui/glass';
import { springy, useReduceMotion } from '../components/ui/motion';
import { colors, font } from '../lib/theme';

export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_MARGIN = 14;

/** Total space the floating bar claims above the screen's bottom edge. */
export const tabBarSpace = (insetBottom: number) =>
  Math.max(insetBottom, 10) + TAB_BAR_MARGIN + TAB_BAR_HEIGHT;

const PILL_INSET_V = 7; // pill top/bottom inset inside the bar
const PILL_INSET_H = 4; // pill side inset inside its slot
const SHIMMER_SWEEP_MS = 2000;
const SHIMMER_IDLE_MS = 3400;
const SHIMMER_WIDTH_RATIO = 0.46;

export function GlassTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const reduceMotion = useReduceMotion();
  const [barWidth, setBarWidth] = useState(0);
  const slotW = barWidth / state.routes.length;

  // Sliding active pill (#3): translateX (native driver — never `left`)
  // springs to the focused slot while a 120ms squish (wide + flat) runs in
  // parallel and springs back — the "gooey" read from the demo.
  const tx = useRef(new Animated.Value(0)).current;
  const squishX = useRef(new Animated.Value(1)).current;
  const squishY = useRef(new Animated.Value(1)).current;
  const prevIndex = useRef(state.index);

  useEffect(() => {
    if (barWidth <= 0) return;
    const to = state.index * slotW + PILL_INSET_H;
    const moved = prevIndex.current !== state.index;
    prevIndex.current = state.index;
    if (!moved || reduceMotion) {
      // First layout, bar resize, or reduce-motion: snap into place.
      tx.setValue(to);
      return;
    }
    Animated.parallel([
      springy(tx, to),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(squishX, { toValue: 1.14, duration: 120, useNativeDriver: true }),
          Animated.timing(squishY, { toValue: 0.86, duration: 120, useNativeDriver: true }),
        ]),
        Animated.parallel([springy(squishX, 1), springy(squishY, 1)]),
      ]),
    ]).start();
  }, [barWidth, slotW, state.index, reduceMotion, tx, squishX, squishY]);

  // Specular sweep (#7): 2s left→right pass, 3.4s idle, looped. Never started
  // under reduce-motion; stopped on unmount (loop.stop in the cleanup).
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion || barWidth <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: SHIMMER_SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(SHIMMER_IDLE_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, barWidth, shimmer]);

  const stripW = barWidth * SHIMMER_WIDTH_RATIO;

  return (
    <GlassPlate
      radius={999}
      style={{
        position: 'absolute',
        left: TAB_BAR_MARGIN,
        right: TAB_BAR_MARGIN,
        bottom: Math.max(insets.bottom, 10) + TAB_BAR_MARGIN,
        height: TAB_BAR_HEIGHT,
      }}
    >
      <View style={s.row} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {barWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.pill,
              {
                width: slotW - PILL_INSET_H * 2,
                transform: [{ translateX: tx }, { scaleX: squishX }, { scaleY: squishY }],
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? colors.accent : colors.faint;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={s.slot}
            >
              {options.tabBarIcon?.({ focused, color, size: 21 })}
              <Text style={[s.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Shimmer strip: absolute over the bar content, clipped by the plate's
          rounded inner. Skew is static on the inner view so the animated
          translateX stays native-driver clean. */}
      {!reduceMotion && barWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.shimmer,
            {
              width: stripW,
              transform: [
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-stripW, barWidth],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.shimmerSkew}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>
      ) : null}
    </GlassPlate>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', height: TAB_BAR_HEIGHT },
  // Pill BEHIND the slots (zIndex 1 vs 2 — handoff pitfall #2 stacking).
  pill: {
    position: 'absolute',
    top: PILL_INSET_V,
    bottom: PILL_INSET_V,
    left: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 1,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, zIndex: 2 },
  label: { fontSize: 10, fontFamily: font.semibold },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  shimmerSkew: { flex: 1, transform: [{ skewX: '-16deg' }] },
});
