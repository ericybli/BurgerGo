/**
 * "Manage trip" bottom sheet (web components/ManageTripSheet.tsx): rename,
 * move the whole date window, add/remove a day at the end, and the cover
 * photo. Each control commits independently; the sheet stays open and shows an
 * inline "Saved ✓" / error line; every success refreshes the Home list.
 *
 * RN extra (kept deliberately — web Home has no delete anywhere): a
 * delete-trip control with the cross-platform two-tap confirm.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, photoUrl, type Trip } from '../../lib/api';
import { colors, font, radius, type } from '../../lib/theme';
import { Button, OfflineHint, Sheet, SheetPanel } from '../../components/ui';
import { addTripDay, removeTripDay } from './homeApi';
import { diffDays, formatDayCount } from './tripDates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAVED = 'Saved ✓';
const SAVE_ERROR = "Couldn't save — please try again.";

/** Inline pill button: teal outline (info ops) or solid orange (add = create). */
function PillButton({
  label,
  onPress,
  disabled,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'orange' | 'danger';
}) {
  if (tone === 'orange') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.pillOrange,
          pressed && !disabled && { backgroundColor: colors.orangePress },
          disabled && s.pillOrangeDisabled,
        ]}
      >
        <Text style={[s.pillOrangeText, disabled && { color: colors.faint }]}>{label}</Text>
      </Pressable>
    );
  }
  const text = tone === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        tone === 'danger' ? s.pillPlain : s.pillTeal,
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[s.pillText, { color: disabled ? colors.faint : text }]}>{label}</Text>
    </Pressable>
  );
}

export function ManageTripSheet({
  trip,
  online,
  onClose,
  onChanged,
  onDeleted,
}: {
  trip: Trip;
  online: boolean;
  onClose: () => void;
  /** Fired after any successful change so the owner can refresh its list. */
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [current, setCurrent] = useState<Trip>(trip);
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Two-tap delete confirm (Alert.alert is a no-op on web).
  const [deleteArmed, setDeleteArmed] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!deleteArmed) return;
    const t = setTimeout(() => setDeleteArmed(false), 3000);
    return () => clearTimeout(t);
  }, [deleteArmed]);

  const lengthDays = diffDays(current.startDate, current.endDate) + 1;
  const busy = pending || uploading;

  /** Run one write; sync local state to the returned trip; show Saved ✓ / error. */
  function run(fn: () => Promise<Trip>, opts: { syncStart?: boolean } = {}) {
    setError(null);
    setStatus(null);
    setPending(true);
    void (async () => {
      try {
        const updated = await fn();
        if (!mounted.current) return;
        setCurrent(updated);
        setName(updated.name);
        if (opts.syncStart) setStartDate(updated.startDate);
        setStatus(SAVED);
        onChanged();
      } catch {
        if (mounted.current) setError(SAVE_ERROR);
      } finally {
        if (mounted.current) setPending(false);
      }
    })();
  }

  /** Pick an image, upload it, set it as the cover, and drop the previous one. */
  async function handleCoverChange() {
    setError(null);
    setStatus(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!mime.startsWith('image/')) return;
    setUploading(true);
    const previous = current.coverPhoto;
    try {
      const { photo } = await api.photos.upload(current.id, 'trip', current.id, {
        uri: asset.uri,
        name: asset.fileName ?? `cover-${Date.now()}.jpg`,
        type: mime,
      });
      const { trip: updated } = await api.trips.update(current.id, { coverPhoto: photo.id });
      // Best-effort cleanup of the replaced photo (failures swallowed).
      if (previous) void api.photos.remove(previous).catch(() => {});
      if (!mounted.current) return;
      setCurrent(updated);
      setStatus(SAVED);
      onChanged();
    } catch {
      if (mounted.current) setError(SAVE_ERROR);
    } finally {
      if (mounted.current) setUploading(false);
    }
  }

  /** Clear the cover (the card falls back to the gradient). */
  function handleCoverRemove() {
    const previous = current.coverPhoto;
    if (!previous) return;
    run(async () => {
      const { trip: updated } = await api.trips.update(current.id, { coverPhoto: null });
      void api.photos.remove(previous).catch(() => {});
      return updated;
    });
  }

  function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setDeleteArmed(false);
    setError(null);
    setStatus(null);
    setPending(true);
    void (async () => {
      try {
        await api.trips.remove(current.id);
        onDeleted();
      } catch {
        if (mounted.current) {
          setPending(false);
          setError("Couldn't delete — please try again.");
        }
      }
    })();
  }

  const trimmedName = name.trim();

  return (
    <Sheet visible onClose={onClose}>
      <SheetPanel title="Manage trip" style={s.panel}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {error ? (
            <Text accessibilityRole="alert" style={s.statusError}>
              {error}
            </Text>
          ) : status ? (
            <Text style={s.statusOk}>{status}</Text>
          ) : null}
          {!online ? <OfflineHint /> : null}

          {/* Rename */}
          <Text style={s.label}>Trip name</Text>
          <View style={s.inlineRow}>
            <Input value={name} onChangeText={setName} editable={!busy} />
            <PillButton
              label="Rename"
              disabled={busy || trimmedName === '' || trimmedName === current.name}
              onPress={() =>
                run(async () => (await api.trips.update(current.id, { name: trimmedName })).trip)
              }
            />
          </View>

          {/* Move the whole window */}
          <Text style={s.heading}>Move dates</Text>
          <Text style={s.label}>New start date</Text>
          <View style={s.inlineRow}>
            <Input
              value={startDate}
              onChangeText={setStartDate}
              editable={!busy}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PillButton
              label="Move"
              disabled={busy || !DATE_RE.test(startDate) || startDate === current.startDate}
              onPress={() =>
                run(async () => (await api.trips.update(current.id, { startDate })).trip, {
                  syncStart: true,
                })
              }
            />
          </View>
          <Text style={s.hint}>Moves the whole trip; scheduled places shift with it.</Text>

          {/* Length: add / remove a day at the end */}
          <Text style={s.heading}>Length</Text>
          <View style={s.lengthRow}>
            <Text style={s.lengthText}>{formatDayCount(lengthDays)}</Text>
            <PillButton
              label="Remove a day"
              disabled={busy || lengthDays <= 1}
              onPress={() => run(() => removeTripDay(current.id, current.endDate))}
            />
            <PillButton
              label="Add a day"
              tone="orange"
              disabled={busy}
              onPress={() => run(() => addTripDay(current.id, current.endDate))}
            />
          </View>
          <Text style={s.hint}>Removing the last day moves any of its places to Saved.</Text>

          {/* Cover photo */}
          <Text style={s.heading}>Cover photo</Text>
          {current.coverPhoto ? (
            <Image
              key={current.coverPhoto}
              source={{ uri: photoUrl.personal(current.coverPhoto, 'card') }}
              style={s.coverPreview}
              resizeMode="cover"
              accessibilityLabel={current.name}
            />
          ) : (
            <Text style={s.hint}>No cover yet — the card shows a gradient.</Text>
          )}
          <View style={s.coverRow}>
            <PillButton
              label={uploading ? 'Uploading…' : current.coverPhoto ? 'Replace cover' : 'Upload cover'}
              disabled={busy}
              onPress={() => void handleCoverChange()}
            />
            {current.coverPhoto ? (
              <PillButton label="Remove" tone="danger" disabled={busy} onPress={handleCoverRemove} />
            ) : null}
          </View>

          {/* RN extra: delete (two-tap confirm) — web Home has no delete UI. */}
          <View style={s.deleteWrap}>
            <Button
              title={deleteArmed ? 'Sure? Delete trip' : 'Delete trip'}
              variant="ghost"
              disabled={busy}
              onPress={handleDelete}
            />
          </View>

          <Button title="Close" variant="secondary" onPress={onClose} style={s.closeBtn} />
        </ScrollView>
      </SheetPanel>
    </Sheet>
  );
}

/** Bare input matching the kit Field's control recipe, without its label/margins. */
function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} {...props} style={[s.input, props.style]} />;
}

const s = StyleSheet.create({
  panel: { maxHeight: '85%' },
  statusError: { marginTop: 8, ...type.caption, color: colors.danger },
  statusOk: { marginTop: 8, ...type.caption, color: colors.accent },
  label: { marginTop: 16, marginBottom: 6, ...type.label, color: colors.ink },
  heading: { marginTop: 24, ...type.heading, color: colors.ink },
  hint: { marginTop: 6, ...type.caption, color: colors.sub },
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
  pillTeal: {
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillPlain: { borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 9 },
  pillText: { fontSize: 13, fontFamily: font.semibold },
  pillOrange: {
    borderRadius: radius.control,
    backgroundColor: colors.orange,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillOrangeDisabled: { backgroundColor: colors.surface },
  pillOrangeText: { fontSize: 13, fontFamily: font.semibold, color: colors.white },
  lengthRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lengthText: { flex: 1, ...type.body, color: colors.ink, fontVariant: ['tabular-nums'] },
  coverPreview: {
    marginTop: 8,
    height: 128,
    width: '100%',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  coverRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteWrap: { marginTop: 16, alignItems: 'center' },
  closeBtn: { marginTop: 8 },
});
