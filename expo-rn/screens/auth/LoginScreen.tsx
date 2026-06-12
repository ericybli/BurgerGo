import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { authClient } from '../../lib/auth';
import { colors, font, type } from '../../lib/theme';
import { Button } from '../../components/ui';

/** Pre-auth gate: cream logo field + Continue with Google (system browser). */
export function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(false);
    const { error: err } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    });
    // No latch write on success: a cancelled browser sheet also resolves
    // error-free. App.tsx sets wasSignedIn authoritatively once a real
    // session appears.
    if (err) setError(true);
    setBusy(false);
  }

  return (
    <View style={s.field}>
      <Image source={require('../../assets/splash-icon.png')} style={s.logo} resizeMode="contain" />
      <Text style={s.title}>BurgerGo</Text>
      <Text style={s.tagline}>Your personal travel-planning assistant.</Text>
      <View style={s.btnWrap}>
        <Button
          title={busy ? 'Connecting…' : 'Continue with Google'}
          variant="secondary"
          disabled={busy}
          onPress={() => void signIn()}
        />
      </View>
      {error ? <Text style={s.error}>Sign-in failed — please try again.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
  },
  logo: { width: 96, height: 96 },
  title: { marginTop: 12, fontSize: 28, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.5 },
  tagline: { marginTop: 4, ...type.body, color: colors.sub },
  // width 100% capped at 320; parent alignItems centers it (no margin auto in RN).
  btnWrap: { marginTop: 36, width: '100%', maxWidth: 320 },
  error: { marginTop: 12, ...type.caption, color: colors.danger },
});
