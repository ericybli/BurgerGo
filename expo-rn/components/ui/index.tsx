/**
 * Shared UI kit for BurgerGo (Atlas Light). Small, dependency-free primitives
 * that encode the design system so section screens stay focused on behavior.
 *
 * Atlas recipes encoded here:
 * - cards = white bg + 1px `line` hairline, radius 14, NO drop shadows
 * - primary button = solid orange (create/save only); disabled = surface bg +
 *   faint text (never opacity — it washes orange to pink)
 * - segmented control = surface track (3px padding) + white thumb w/ subtle
 *   shadow + ink text; inactive = sub text (web EatsClient)
 * - bottom sheet = floating glass panel (GlassPlate strength="sheet", radius 26,
 *   inset 8 from edges), 40×4 drag handle, animated ink scrim (handoff #11)
 * - text buttons: accent teal = info/nav, danger = destructive
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { colors, font, radius, type } from '../../lib/theme';
import { GlassPlate } from './glass';
import { springy, usePressScale } from './motion';

// --- Screen container -------------------------------------------------------

export function Screen({
  children,
  scroll = false,
  contentStyle,
  bottomInset = 40,
  topInset,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Scroll-content bottom padding; tab screens pass ~150 to clear the floating glass tab bar. */
  bottomInset?: number;
  /** Scroll-content top padding; screens under a transparent glass header pass headerHeight + 8. */
  topInset?: number;
}) {
  if (scroll) {
    return (
      <ScrollView
        style={s.screen}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: bottomInset },
          topInset !== undefined && { paddingTop: topInset },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[s.screen, contentStyle]}>{children}</View>;
}

// --- Button -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'secondary' | 'text';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || busy;
  const solid = variant === 'primary' || variant === 'danger';
  const press = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.btnPrimary,
        variant === 'primary' && pressed && s.btnPrimaryPressed,
        variant === 'danger' && s.btnDanger,
        variant === 'secondary' && s.btnSecondary,
        variant === 'secondary' && pressed && s.btnSecondaryPressed,
        (variant === 'ghost' || variant === 'text') && s.btnPlain,
        // Solid buttons swap to surface/faint when disabled (no opacity wash);
        // outlined/text buttons just dim.
        isDisabled && (solid ? s.btnDisabledSolid : s.btnDisabledPlain),
        pressed && !solid && !isDisabled && { opacity: 0.7 },
        style,
      ]}
    >
      {/* Press feedback (handoff #10): content dips to 0.94, springy release. */}
      <Animated.View style={press.style}>
        <Text
          style={[
            s.btnText,
            solid && s.btnTextLight,
            variant === 'secondary' && s.btnTextDark,
            variant === 'ghost' && s.btnTextDangerGhost,
            variant === 'text' && s.btnTextAccent,
            isDisabled && solid && s.btnTextDisabled,
          ]}
        >
          {busy ? '…' : title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// --- Field (labeled text input) --------------------------------------------

export function Field({
  label,
  style,
  ...inputProps
}: { label?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[
          s.input,
          inputProps.multiline && s.inputMultiline,
          focused && s.inputFocused,
          style,
        ]}
      />
    </View>
  );
}

// --- Segmented control ------------------------------------------------------

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.segment}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            style={[s.segmentItem, active && s.segmentItemActive]}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Icon button (38px square, map-control style) ----------------------------

export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  active,
  disabled,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const press = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        s.iconBtn,
        active && s.iconBtnActive,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Animated.View style={press.style}>{children}</Animated.View>
    </Pressable>
  );
}

// --- States -----------------------------------------------------------------

export function Loading({ label }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={s.mutedSpaced}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  headline,
  subtext,
  action,
}: {
  headline: string;
  subtext?: string;
  action?: ReactNode;
}) {
  return (
    <View style={s.center}>
      {/* Web EmptyState: bundled mascot above the headline (112×112, opacity .9). */}
      <Image source={require('../../assets/burgergo-logo.png')} style={s.emptyMascot} />
      <Text style={s.emptyHead}>{headline}</Text>
      {subtext ? <Text style={s.emptySub}>{subtext}</Text> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  headline,
  subtext,
  onRetry,
}: {
  headline: string;
  subtext?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      headline={headline}
      subtext={subtext}
      action={onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : undefined}
    />
  );
}

// --- Card -------------------------------------------------------------------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// --- Chip -------------------------------------------------------------------

type ChipTone = 'neutral' | 'accent' | 'orange' | 'ink' | 'success' | 'danger'
  // legacy aliases (pre-Atlas screens)
  | 'muted' | 'teal' | 'coral';

const CHIP_TONE: Record<ChipTone, { bg: string; text: string }> = {
  neutral: { bg: colors.surface, text: colors.sub },
  accent: { bg: colors.accentTint, text: colors.accent },
  orange: { bg: colors.orangeTint, text: colors.orange },
  ink: { bg: colors.ink, text: colors.white },
  success: { bg: 'rgba(62, 142, 110, 0.12)', text: colors.success },
  danger: { bg: 'rgba(179, 64, 44, 0.12)', text: colors.danger },
  muted: { bg: colors.surface, text: colors.sub },
  teal: { bg: colors.accentTint, text: colors.accent },
  coral: { bg: colors.orangeTint, text: colors.orange },
};

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const t = CHIP_TONE[tone];
  return (
    <View style={[s.chip, { backgroundColor: t.bg }]}>
      <Text style={[s.chipText, { color: t.text }]}>{label}</Text>
    </View>
  );
}

// --- Progress bar -----------------------------------------------------------

export function ProgressBar({ percent, over }: { percent: number; over?: boolean }) {
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${percent}%` }, over && s.barFillOver]} />
    </View>
  );
}

// --- Select (modal picker) --------------------------------------------------

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select…',
}: {
  label?: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={[s.input, s.selectRow, disabled && { opacity: 0.5 }]}
      >
        <Text style={[s.selectValue, !current && { color: colors.faint }]}>
          {current ? current.label : placeholder}
        </Text>
        <Text style={s.selectChevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.selectBackdrop} onPress={() => setOpen(false)}>
          <View style={s.selectMenu}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={s.selectOption}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[s.selectOptionText, active && s.selectOptionActive]}>{item.label}</Text>
                    {active ? <Text style={s.selectCheck}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// --- Sheet (bottom-modal that lifts above the keyboard) ---------------------

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  // Entrance (handoff #11): backdrop fades 0→1 over 240ms; panel rises
  // translateY(46)→0 + fades with an overshoot spring. Closing stays INSTANT
  // (Modal unmounts on onClose — no exit animation).
  const backdrop = useRef(new Animated.Value(0)).current;
  const panel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      // Reset the pre-state so a re-open without a remount replays the entrance.
      backdrop.setValue(0);
      panel.setValue(0);
      return;
    }
    let cancelled = false;
    // Read reduce-motion directly: useReduceMotion()'s first render is always
    // `false` while the async query resolves (motion.ts pitfall).
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        backdrop.setValue(1);
        panel.setValue(1);
        return;
      }
      Animated.timing(backdrop, { toValue: 1, duration: 240, useNativeDriver: true }).start();
      springy(panel, 1).start();
    });
    return () => {
      cancelled = true;
    };
  }, [visible, backdrop, panel]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <Animated.View pointerEvents="none" style={[s.sheetBackdrop, { opacity: backdrop }]} />
        {/* Tap outside the sheet to dismiss. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.sheetKav}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{
              opacity: panel,
              transform: [
                { translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [46, 0] }) },
              ],
            }}
          >
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Liquid-glass sheet panel: floating GlassPlate (strength "sheet" for dense
 * content readability), radius 26, inset 8 from the screen edges, drag handle.
 * Use as the direct child of <Sheet>; put scrollable content inside.
 */
export function SheetPanel({
  children,
  title,
  style,
}: {
  children: ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassPlate strength="sheet" radius={26} style={[s.sheetPanel, style]}>
      <View style={s.sheetHandle} />
      {title ? <Text style={s.sheetTitle}>{title}</Text> : null}
      {children}
    </GlassPlate>
  );
}

// --- Offline hint -----------------------------------------------------------

export function OfflineHint({ text = 'Connect to the internet to make changes.' }: { text?: string }) {
  return <Text style={s.offline}>{text}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  mutedSpaced: { marginTop: 10, color: colors.sub, fontSize: 14, fontFamily: font.regular },
  // mb-6 on web = 24px below mascot; container gap (6) supplies the rest.
  emptyMascot: { width: 112, height: 112, opacity: 0.9, marginBottom: 18 },
  emptyHead: { ...type.heading, fontSize: 16, color: colors.ink, textAlign: 'center' },
  emptySub: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: colors.sub, textAlign: 'center', fontFamily: font.regular },

  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.orange },
  btnPrimaryPressed: { backgroundColor: colors.orangePress },
  btnDanger: { backgroundColor: colors.danger },
  btnSecondary: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  btnSecondaryPressed: { backgroundColor: colors.surface },
  btnPlain: { backgroundColor: 'transparent', paddingVertical: 10 },
  btnDisabledSolid: { backgroundColor: colors.surface },
  btnDisabledPlain: { opacity: 0.45 },
  btnText: { fontSize: 14, fontFamily: font.semibold },
  btnTextLight: { color: colors.white },
  btnTextDark: { color: colors.ink },
  btnTextDangerGhost: { color: colors.danger },
  btnTextAccent: { color: colors.accent },
  btnTextDisabled: { color: colors.faint },

  field: { marginTop: 14 },
  label: { marginBottom: 6, fontSize: 13, fontFamily: font.semibold, color: colors.ink },
  input: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, borderRadius: radius.control,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.ink, fontFamily: font.regular,
  },
  inputFocused: { borderColor: colors.accent },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },

  segment: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.control, padding: 3, gap: 3,
  },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  segmentItemActive: {
    backgroundColor: colors.bg,
    // Atlas thumb shadow (the one allowed card shadow).
    shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  segmentText: { fontSize: 13, fontFamily: font.semibold, color: colors.sub },
  segmentTextActive: { color: colors.ink },

  iconBtn: {
    width: 38, height: 38, borderRadius: radius.control, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },

  card: {
    backgroundColor: colors.bg, borderRadius: radius.card, padding: 16,
    borderWidth: 1, borderColor: colors.line,
  },

  chip: { borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontFamily: font.semibold },

  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.surface, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.accent },
  barFillOver: { backgroundColor: colors.danger },

  offline: { marginTop: 10, fontSize: 13, color: colors.faint, fontStyle: 'italic', fontFamily: font.regular },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  // Handoff #11 backdrop (animated layer; scrim color no longer on sheetRoot).
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,31,28,0.30)' },
  sheetKav: { justifyContent: 'flex-end' },
  // Placement (margins) goes to GlassPlate's outer shadow view; padding to the
  // inner clipped view (see glass.tsx splitStyle).
  sheetPanel: {
    marginHorizontal: 8, marginBottom: 8,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 10 },
  sheetTitle: { ...type.title, color: colors.ink, marginBottom: 6 },

  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { fontSize: 15, color: colors.ink, flex: 1, fontFamily: font.regular },
  selectChevron: { fontSize: 13, color: colors.faint, marginLeft: 8 },
  selectBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 28 },
  selectMenu: { backgroundColor: colors.bg, borderRadius: radius.card, maxHeight: '70%', overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  selectOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  selectOptionText: { fontSize: 15, color: colors.ink, fontFamily: font.regular },
  selectOptionActive: { color: colors.accent, fontFamily: font.bold },
  selectCheck: { color: colors.accent, fontSize: 16, fontFamily: font.bold },
});
