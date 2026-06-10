/**
 * Budget-local web-parity UI pieces. Section-owned — the shared kit
 * (`components/ui`) and `lib/theme.ts` stay untouched. Each exists because a
 * kit/theme value deviates from the web Atlas recipe:
 *
 * - SCRIM / BudgetSheet / BudgetSelect: web `--scrim` = rgb(27 31 28 / 0.42)
 *   (app/globals.css) vs kit colors.scrim at 0.35 — sheet and select-picker
 *   backdrops rendered too light.
 * - sheetShadow: web sheets use `shadow-sheet` (0 -12px 40px rgb(27 31 28 /
 *   0.25)), one of the only two shadows Atlas allows; kit SheetPanel has none.
 *   Pass via SheetPanel's `style` prop.
 * - OfflineNote: web offline hint is `text-caption text-sub` (12 medium,
 *   non-italic); kit OfflineHint renders 13 italic faint.
 * - MascotState: web `components/EmptyState.tsx` parity — bundled 112px mascot
 *   at 90% opacity above headline/subtext; kit EmptyState/ErrorState are
 *   text-only.
 *
 * Fold back into the kit when the kit-level fixes land.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, type } from '../../lib/theme';

const MASCOT = require('../../assets/burgergo-logo.png');

/** Web `--scrim` (rgb(27 31 28 / 0.42)). */
const SCRIM = 'rgba(27, 31, 28, 0.42)';

/** Web `shadow-sheet` — apply to SheetPanel via its `style` prop. */
export const sheetShadow: ViewStyle = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: -12 },
  shadowOpacity: 0.25,
  shadowRadius: 40,
};

// --- Sheet (kit Sheet with the web 0.42 scrim) -------------------------------

export function BudgetSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.sheetRoot}>
        {/* Tap outside the sheet to dismiss. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={st.sheetKav}
          pointerEvents="box-none"
        >
          {children}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// --- Select (kit Select with the web 0.42 scrim backdrop) --------------------

export function BudgetSelect<T extends string>({
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
    <View style={st.field}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={[st.input, st.selectRow, disabled && { opacity: 0.5 }]}
      >
        <Text style={[st.selectValue, !current && { color: colors.faint }]}>
          {current ? current.label : placeholder}
        </Text>
        <Text style={st.selectChevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.selectBackdrop} onPress={() => setOpen(false)}>
          <View style={st.selectMenu}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={st.selectOption}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[st.selectOptionText, active && st.selectOptionActive]}>
                      {item.label}
                    </Text>
                    {active ? <Text style={st.selectCheck}>✓</Text> : null}
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

// --- Offline hint (web `text-caption text-sub`, non-italic) ------------------

export function OfflineNote({
  text = 'Connect to the internet to make changes.',
}: {
  text?: string;
}) {
  return <Text style={st.offline}>{text}</Text>;
}

// --- Empty/error state with the bundled mascot -------------------------------

export function MascotState({
  alt,
  headline,
  subtext,
  action,
  fill,
}: {
  alt: string;
  headline: string;
  subtext?: string;
  /** Spec-blessed RN extra (e.g. Retry button); web EmptyState uses onAction. */
  action?: ReactNode;
  /** Fill + center vertically (screen-level error state). */
  fill?: boolean;
}) {
  return (
    <View style={[st.empty, fill && st.emptyFill]}>
      <Image source={MASCOT} accessibilityLabel={alt} style={st.mascot} resizeMode="contain" />
      <Text style={st.emptyHead}>{headline}</Text>
      {subtext ? <Text style={st.emptySub}>{subtext}</Text> : null}
      {action ? <View style={{ marginTop: 24 }}>{action}</View> : null}
    </View>
  );
}

const st = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: SCRIM },
  sheetKav: { justifyContent: 'flex-end' },

  field: { marginTop: 14 },
  label: { marginBottom: 6, fontSize: 13, fontFamily: font.semibold, color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    fontFamily: font.regular,
  },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { fontSize: 15, color: colors.ink, flex: 1, fontFamily: font.regular },
  selectChevron: { fontSize: 13, color: colors.faint, marginLeft: 8 },
  selectBackdrop: { flex: 1, backgroundColor: SCRIM, justifyContent: 'center', padding: 28 },
  selectMenu: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    maxHeight: '70%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  selectOptionText: { fontSize: 15, color: colors.ink, fontFamily: font.regular },
  selectOptionActive: { color: colors.accent, fontFamily: font.bold },
  selectCheck: { color: colors.accent, fontSize: 16, fontFamily: font.bold },

  offline: { marginTop: 10, ...type.caption, color: colors.sub },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  emptyFill: { flex: 1, backgroundColor: colors.bg },
  mascot: { width: 112, height: 112, opacity: 0.9, marginBottom: 24 },
  emptyHead: { ...type.heading, color: colors.ink, textAlign: 'center' },
  emptySub: { ...type.body, color: colors.sub, textAlign: 'center', marginTop: 8, maxWidth: 320 },
});
