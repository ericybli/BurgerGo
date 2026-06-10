/**
 * Local helpers for the To-do section (Tasks + Packing). Section-owned —
 * the shared UI kit stays untouched.
 *
 * - MascotEmpty: web `components/EmptyState.tsx` parity (bundled mascot 112px
 *   @ 90% opacity above headline/subtext).
 * - CheckBox: Atlas 21×21 / 1.5px faint border; checked = accent fill + white
 *   lucide Check (strokeWidth 3). Radius 7 (web Packing `rounded-[7px]`), or a
 *   full circle via `round` (web Tasks `rounded-chip` = 999px).
 * - useTwoTapConfirm: cross-platform destructive-action confirm (first tap
 *   arms → danger "Sure?", second tap executes; auto-disarms after 3s).
 * - FadeUp: tasks-list entrance stagger (web `animate-fade-up`, 40ms × min(i,6)).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, font, type } from '../../lib/theme';

const MASCOT = require('../../assets/burgergo-logo.png');

export function MascotEmpty({
  alt,
  headline,
  subtext,
}: {
  alt: string;
  headline: string;
  subtext: string;
}) {
  return (
    <View style={st.empty}>
      <Image source={MASCOT} accessibilityLabel={alt} style={st.mascot} resizeMode="contain" />
      <Text style={st.emptyHead}>{headline}</Text>
      <Text style={st.emptySub}>{subtext}</Text>
    </View>
  );
}

export function CheckBox({
  checked,
  onToggle,
  disabled,
  round,
  accessibilityLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Circle (web Tasks `rounded-chip`); default is radius 7 (web Packing). */
  round?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[st.checkbox, round && st.checkboxRound, checked && st.checkboxOn, disabled && st.dim40]}
    >
      {checked ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
    </Pressable>
  );
}

/**
 * Two-tap confirm for destructive buttons (Alert.alert is a no-op on web).
 * First `fire()` arms (render a danger "Sure?" state while `armed`); second
 * `fire()` runs the action. Auto-disarms after `timeoutMs`.
 */
export function useTwoTapConfirm(action: () => void, timeoutMs = 3000) {
  const [armed, setArmed] = useState(false);
  const actionRef = useRef(action);
  actionRef.current = action;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function fire() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (armed) {
      setArmed(false);
      actionRef.current();
    } else {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), timeoutMs);
    }
  }

  return { armed, fire };
}

/** Entrance fade-up; delay = min(index, 6) × 40ms (web task-list stagger). */
export function FadeUp({ index, children }: { index: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 6) * 40,
      useNativeDriver: true,
    }).start();
    // Mount-only: re-indexing after deletes shouldn't replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Danger "Sure?" label for an armed two-tap delete button. */
export function SureLabel() {
  return <Text style={st.sure}>Sure?</Text>;
}

const st = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 64 },
  mascot: { width: 112, height: 112, opacity: 0.9, marginBottom: 24 },
  emptyHead: { ...type.heading, color: colors.ink, textAlign: 'center' },
  emptySub: { ...type.body, color: colors.sub, textAlign: 'center', marginTop: 8, maxWidth: 320 },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.faint,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRound: { borderRadius: 999 },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dim40: { opacity: 0.4 },

  sure: { fontSize: 12, fontFamily: font.semibold, color: colors.danger },
});
