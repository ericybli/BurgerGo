/**
 * Swipeable list row with trailing action buttons (Edit / Delete), the RN
 * counterpart of the web `components/SwipeRow.tsx`. Pure PanResponder +
 * Animated (no extra deps) so it runs on iOS Expo Go AND react-native-web.
 *
 * - Horizontal drags past a 6px threshold reveal `actions.length * 76`px of
 *   buttons; release snaps open past the halfway point, else closed.
 * - Tapping an open row closes it instead of activating the row.
 * - Actions are never the only path to a behavior (parity with web): edit is
 *   also tap-on-row, delete is also inside the edit sheet.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../../lib/theme';

export type SwipeAction = {
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Keep the row open after pressing (e.g. arming a two-tap delete). */
  keepOpen?: boolean;
};

const ACTION_WIDTH = 76; // px per revealed action button
const DRAG_THRESHOLD = 6; // px before a horizontal move counts as a swipe

export function SwipeRow({
  children,
  actions,
  disabled = false,
  onClose,
}: {
  children: ReactNode;
  actions: SwipeAction[];
  disabled?: boolean;
  /** Fired whenever the row settles closed (used to disarm two-tap deletes). */
  onClose?: () => void;
}) {
  const revealWidth = actions.length * ACTION_WIDTH;
  const tx = useRef(new Animated.Value(0)).current;
  const baseRef = useRef(0); // settled offset: 0 (closed) or -revealWidth (open)
  const [open, setOpen] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const settle = useCallback(
    (to: number) => {
      baseRef.current = to;
      setOpen(to !== 0);
      if (to === 0) onCloseRef.current?.();
      Animated.spring(tx, { toValue: to, bounciness: 0, useNativeDriver: false }).start();
    },
    [tx],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim only horizontal-dominant moves so vertical list scrolling wins.
        onMoveShouldSetPanResponder: (_e, g) =>
          !disabled &&
          actions.length > 0 &&
          Math.abs(g.dx) > DRAG_THRESHOLD &&
          Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          tx.setValue(Math.max(-revealWidth, Math.min(0, baseRef.current + g.dx)));
        },
        onPanResponderRelease: (_e, g) => {
          settle(baseRef.current + g.dx < -revealWidth / 2 ? -revealWidth : 0);
        },
        onPanResponderTerminate: () => settle(0),
      }),
    [disabled, actions.length, revealWidth, settle, tx],
  );

  return (
    <View style={s.wrap}>
      {actions.length > 0 ? (
        <View style={s.actions}>
          {actions.map((a, i) => (
            <Pressable
              key={i}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                a.onPress();
                if (!a.keepOpen) settle(0);
              }}
              style={({ pressed }) => [
                s.action,
                { backgroundColor: a.danger ? colors.danger : colors.accent },
                pressed && { opacity: 0.85 },
                disabled && { opacity: 0.6 },
              ]}
            >
              <Text style={s.actionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Animated.View
        {...pan.panHandlers}
        style={[s.content, { transform: [{ translateX: tx }] }]}
      >
        {children}
        {open ? (
          // Tapping an open row closes it rather than activating the row.
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close actions"
            onPress={() => settle(0)}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
  },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center' },
  actionText: { ...type.caption, color: colors.white },
  content: { backgroundColor: colors.bg },
});
