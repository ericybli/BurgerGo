/**
 * Profile card — first card on Settings. Avatar (tap to change), display-name
 * edit, read-only email, and sign-out with the cross-platform two-tap confirm
 * (mirrors ManageTripSheet's idioms). Renders nothing until /api/me resolves;
 * getJson caches it, so offline relaunches still show the last profile.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, photoUrl } from '../../lib/api';
import { authClient, setWasSignedIn } from '../../lib/auth';
import { colors, font, radius, type } from '../../lib/theme';
import { Button, Card, OfflineHint } from '../../components/ui';

type Status = 'idle' | 'saved' | 'error';

const SAVE_ERROR = "Couldn't save — please try again.";

export function ProfileCard({ online }: { online: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Two-tap sign-out confirm (Alert.alert is a no-op on web).
  const [signOutArmed, setSignOutArmed] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!signOutArmed) return;
    const t = setTimeout(() => setSignOutArmed(false), 3000);
    return () => clearTimeout(t);
  }, [signOutArmed]);

  useEffect(() => {
    let active = true;
    api.me
      .get()
      .then(({ user }) => {
        if (!active) return;
        setName(user.name);
        setSavedName(user.name);
        setEmail(user.email);
        setImage(user.image);
        setLoaded(true);
      })
      .catch(() => {
        /* offline + uncached → card stays absent */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;

  const busy = saving || uploading;
  const trimmedName = name.trim();

  /** Pick a square image and upload it as the new avatar. */
  async function handleAvatarChange() {
    if (!online || busy) return;
    setStatus('idle');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!mime.startsWith('image/')) return;
    setUploading(true);
    try {
      const { image: next } = await api.me.uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: mime,
      });
      if (!mounted.current) return;
      setImage(next);
      setStatus('saved');
    } catch {
      if (mounted.current) setStatus('error');
    } finally {
      if (mounted.current) setUploading(false);
    }
  }

  function handleSaveName() {
    setStatus('idle');
    setSaving(true);
    void (async () => {
      try {
        const { user } = await api.me.updateName(trimmedName);
        if (!mounted.current) return;
        setName(user.name);
        setSavedName(user.name);
        setStatus('saved');
      } catch {
        if (mounted.current) setStatus('error');
      } finally {
        if (mounted.current) setSaving(false);
      }
    })();
  }

  function handleSignOut() {
    if (!signOutArmed) {
      setSignOutArmed(true);
      return;
    }
    setSignOutArmed(false);
    void (async () => {
      try {
        await authClient.signOut();
        await setWasSignedIn(false);
        // App.tsx's useSession flips to LoginScreen — no navigation needed.
      } catch {
        if (mounted.current) setStatus('error');
      }
    })();
  }

  return (
    <Card>
      <View style={s.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change avatar"
          disabled={!online || busy}
          onPress={() => void handleAvatarChange()}
          style={({ pressed }) => [pressed && !busy && { opacity: 0.7 }]}
        >
          {image ? (
            <Image
              key={image}
              source={{ uri: photoUrl.avatar(image) }}
              style={s.avatar}
              accessibilityLabel="Your avatar"
            />
          ) : (
            <View style={[s.avatar, s.avatarEmpty]}>
              <Text style={s.avatarInitial}>{(savedName || email).charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.cardTitle}>Profile</Text>
          <Text style={s.email} numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>

      <Text style={s.label}>Display name</Text>
      <View style={s.inlineRow}>
        <Input value={name} onChangeText={setName} editable={online && !busy} />
        <Pressable
          accessibilityRole="button"
          disabled={!online || busy || trimmedName === '' || trimmedName === savedName}
          onPress={handleSaveName}
          style={({ pressed }) => {
            const disabled = !online || busy || trimmedName === '' || trimmedName === savedName;
            return [s.pillTeal, pressed && !disabled && { opacity: 0.7 }, disabled && { opacity: 0.4 }];
          }}
        >
          <Text
            style={[
              s.pillText,
              {
                color:
                  !online || busy || trimmedName === '' || trimmedName === savedName
                    ? colors.faint
                    : colors.accent,
              },
            ]}
          >
            {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
          </Text>
        </Pressable>
      </View>
      {status === 'saved' ? (
        <Text style={[s.status, { color: colors.accent }]}>Saved ✓</Text>
      ) : status === 'error' ? (
        <Text accessibilityRole="alert" style={[s.status, { color: colors.danger }]}>
          {SAVE_ERROR}
        </Text>
      ) : null}
      {!online ? <OfflineHint /> : null}

      <View style={s.signOutWrap}>
        <Button
          title={signOutArmed ? 'Sure? Sign out' : 'Sign out'}
          variant="ghost"
          disabled={!online || busy}
          onPress={handleSignOut}
        />
      </View>
    </Card>
  );
}

/** Bare input matching the kit Field's control recipe (ManageTripSheet idiom). */
function Input(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[s.input, focused && s.inputFocused, props.style]}
    />
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.heading, color: colors.ink },
  email: { ...type.caption, marginTop: 2, color: colors.sub },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarEmpty: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatarInitial: { fontFamily: font.semibold, fontSize: 18, color: colors.sub },
  label: { marginTop: 14, marginBottom: 6, ...type.label, color: colors.ink },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
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
  pillTeal: {
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillText: { fontSize: 13, fontFamily: font.semibold },
  status: { ...type.caption, marginTop: 8 },
  signOutWrap: { marginTop: 12, alignItems: 'center' },
});
