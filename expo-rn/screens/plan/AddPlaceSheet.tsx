import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { api } from '../../lib/api';
import { CATEGORIES, colors, font, radius, type } from '../../lib/theme';
import { Button, Field, OfflineHint, Select } from '../../components/ui';
import { categoryLabel } from './planShared';
import { useAutocomplete } from './useAutocomplete';
import { forwardGeocode, generateSummary, placeDetails } from './planApi';

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c as string, label: categoryLabel(c) }));

/**
 * "Add place" sheet (web AddPlaceSheet) — remounted blank on each open. Name +
 * Address with Google autocomplete (pick a suggestion to capture coords/place
 * id + category guess; typing afterwards invalidates the pick; × clears) +
 * Category (default "other"). Saving with a typed address forward-geocodes it;
 * a resolved place id pulls Details (caches the photo) and can auto-fill the
 * name. AI summary fires after create (never blocks).
 */
export function AddPlaceSheet({
  tripId,
  dayDate,
  online,
  onClose,
  onAdded,
}: {
  tripId: string;
  /** Target bucket: a day date for Days, or null for the Saved bucket. */
  dayDate: string | null;
  online: boolean;
  onClose: () => void;
  /** Parent recomputes the day (when dayDate) + refetches + closes. */
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<string>('other');
  /** Coordinates + place id captured when a Google suggestion is picked. */
  const [picked, setPicked] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { predictions, search, select, clear } = useAutocomplete();

  function handleAddressChange(value: string) {
    setAddress(value);
    setPicked(null); // editing the text invalidates any prior suggestion pick
    search(value);
  }

  function handleAddressClear() {
    setAddress('');
    setPicked(null);
    clear();
  }

  async function handlePick(placeId: string) {
    const filled = await select(placeId);
    if (!filled) return;
    if (!name.trim() && filled.name) setName(filled.name);
    if (filled.address) setAddress(filled.address);
    if (filled.categoryGuess && (CATEGORIES as readonly string[]).includes(filled.categoryGuess)) {
      setCategory(filled.categoryGuess);
    }
    if (typeof filled.lat === 'number' && typeof filled.lng === 'number') {
      setPicked({ lat: filled.lat, lng: filled.lng, googlePlaceId: filled.googlePlaceId });
    }
    clear(); // hide the suggestion list once one is chosen
  }

  async function handleSave() {
    setError(null);
    const trimmedName = name.trim();
    const trimmedAddress = address.trim() || null;
    // Require a name OR an address — a typed address can resolve to a Google
    // place whose name is auto-filled below.
    if (!trimmedName && !trimmedAddress) {
      setError('Please enter a name.');
      return;
    }
    setBusy(true);
    try {
      let lat: number | null = picked?.lat ?? null;
      let lng: number | null = picked?.lng ?? null;
      let googlePlaceId: string | null = picked?.googlePlaceId ?? null;
      let resolvedName = trimmedName;
      // No coords from a suggestion but a typed address → best-effort forward
      // geocode so the place maps + routes. A match with a place id pulls
      // Details (downloads + caches the photo) and can fill the name.
      if (lat === null && trimmedAddress) {
        const geo = await forwardGeocode(trimmedAddress);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          if (geo.googlePlaceId) {
            const details = await placeDetails(geo.googlePlaceId);
            googlePlaceId = details?.googlePlaceId || geo.googlePlaceId;
            if (!resolvedName && details?.name) resolvedName = details.name;
          }
        }
      }
      // Fall back to the typed address as a name when none could be derived.
      if (!resolvedName) resolvedName = trimmedAddress ?? '';
      if (!resolvedName) {
        setError('Please enter a name.');
        setBusy(false);
        return;
      }
      const { place } = await api.places.create(tripId, {
        name: resolvedName,
        address: trimmedAddress,
        lat,
        lng,
        category,
        googlePlaceId,
        dayDate,
      });
      // Fire-and-forget AI summary; the refetch picks it up when it lands.
      void generateSummary(tripId, place.id).catch(() => {});
      onAdded();
    } catch {
      setBusy(false);
      setError('Couldn’t save — please try again.');
    }
  }

  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <Text style={styles.title}>Add place</Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Field label="Name" value={name} onChangeText={setName} editable={!busy} />

      <View>
        <Field
          label="Address"
          value={address}
          onChangeText={handleAddressChange}
          editable={!busy}
          placeholder="Search or type an address"
          autoCapitalize="words"
          autoCorrect={false}
          style={{ paddingRight: 38 }}
        />
        {address && !busy ? (
          <Pressable accessibilityLabel="Clear address" hitSlop={6} onPress={handleAddressClear} style={styles.clearBtn}>
            <X size={16} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Pick a suggestion, or just type an address.</Text>

      {predictions.length > 0 ? (
        <View style={styles.suggestions}>
          {predictions.map((p, i) => (
            <Pressable
              key={p.placeId}
              disabled={busy}
              onPress={() => void handlePick(p.placeId)}
              style={({ pressed }) => [
                styles.suggestion,
                i < predictions.length - 1 && styles.suggestionDivider,
                pressed && { backgroundColor: colors.surface },
              ]}
            >
              <Text style={styles.suggestionText}>{p.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Select label="Category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} disabled={busy} />

      {!online ? <OfflineHint /> : null}

      <Button title="Save" onPress={() => void handleSave()} busy={busy} disabled={!online} style={{ marginTop: 20 }} />
      <Button title="Cancel" variant="secondary" onPress={onClose} disabled={busy} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheetScroll: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheet: { padding: 18, paddingTop: 8, paddingBottom: 32 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  title: { ...type.title, fontSize: 18, color: colors.ink },
  error: {
    marginTop: 12,
    borderRadius: radius.control,
    backgroundColor: colors.orangeTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.danger,
  },
  hint: { marginTop: 5, fontFamily: font.medium, fontSize: 12, color: colors.sub },
  clearBtn: {
    position: 'absolute',
    right: 8,
    bottom: 9,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { marginTop: 8, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  suggestion: { paddingHorizontal: 12, paddingVertical: 10 },
  suggestionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { ...type.body, color: colors.ink },
});
