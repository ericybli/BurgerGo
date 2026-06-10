/**
 * Small Atlas Light form primitives local to the Journal section: web-style
 * micro-uppercase field labels, the danger/10 error banner, and the two small
 * button recipes the web journal uses (orange create/save pill, accent
 * outline photo button).
 */
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { colors, font, radius, type } from '../../lib/theme';

/** Labeled input with the web journal's micro-uppercase faint label. */
export function FormField({
  label,
  style,
  ...inputProps
}: { label: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fb.field}>
      <Text style={fb.micro}>{label}</Text>
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
          fb.input,
          inputProps.multiline && fb.inputMultiline,
          focused && fb.inputFocused,
          inputProps.editable === false && fb.inputDisabled,
          style,
        ]}
      />
    </View>
  );
}

/** Web's `bg-danger/10` rounded error banner (role=alert equivalent). */
export function ErrorBanner({ text, style }: { text: string; style?: object }) {
  return (
    <View style={[fb.banner, style]} accessibilityRole="alert">
      <Text style={fb.bannerText}>{text}</Text>
    </View>
  );
}

/** Small orange pill — the web's per-tab create button (px-3.5 py-2). */
export function SmallPrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        fb.smallBtn,
        pressed && !disabled && fb.smallBtnPressed,
        disabled && fb.smallBtnDisabled,
      ]}
    >
      <Text style={[fb.smallBtnText, disabled && fb.smallBtnTextDisabled]}>{title}</Text>
    </Pressable>
  );
}

/** Accent outline button (web's "Add photos" / photo-picker recipe). */
export function OutlineAccentButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        fb.outlineBtn,
        pressed && !disabled && fb.outlineBtnPressed,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={fb.outlineBtnText}>{title}</Text>
    </Pressable>
  );
}

const fb = StyleSheet.create({
  field: { marginTop: 12 },
  micro: { ...type.micro, color: colors.faint, textTransform: 'uppercase' },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    fontFamily: font.regular,
  },
  inputFocused: { borderColor: colors.accent },
  inputMultiline: { textAlignVertical: 'top' },
  inputDisabled: { opacity: 0.6 }, // web parity: disabled:opacity-60

  banner: {
    backgroundColor: 'rgba(179, 64, 44, 0.10)',
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerText: { ...type.caption, color: colors.danger },

  smallBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnPressed: { backgroundColor: colors.orangePress },
  smallBtnDisabled: { backgroundColor: colors.surface },
  smallBtnText: { ...type.label, color: colors.white },
  smallBtnTextDisabled: { color: colors.faint },

  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  outlineBtnPressed: { backgroundColor: colors.accentTint },
  outlineBtnText: { ...type.label, color: colors.accent },
});
