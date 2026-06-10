/**
 * First-run welcome note on Home (web components/OnboardingNote.tsx). Explains
 * that BurgerGo is read-only offline and the map can look blank without a
 * connection. Dismissed once, then remembered via AsyncStorage under the same
 * key the web uses in localStorage. Renders nothing until the flag is read
 * (no flash) and nothing once dismissed.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, radius, type } from '../../lib/theme';

const STORAGE_KEY = 'burgergo.onboarded';

export function OnboardingNote() {
  // null = storage not read yet → render nothing (avoid a flash).
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => active && setShow(v !== '1'))
      .catch(() => active && setShow(false));
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>Welcome to BurgerGo</Text>
      <Text style={s.body}>
        Plan your trip day by day — places, map, eats, budget, packing, and a journal. Anything
        you've opened stays readable offline; edits need a connection. The in-app map needs the
        network too, so it can look blank offline — that's normal.
      </Text>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
      >
        <Text style={s.btnText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: 16,
  },
  title: { ...type.heading, color: colors.ink },
  body: { marginTop: 4, ...type.caption, lineHeight: 18, color: colors.sub },
  btn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: radius.control,
    backgroundColor: colors.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnPressed: { backgroundColor: colors.orangePress },
  btnText: { fontSize: 13, fontFamily: font.semibold, color: colors.white },
});
