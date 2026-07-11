/**
 * Add / edit restaurant form (Atlas Light), rendered inside the Eats screen's
 * bottom <Sheet>. `restaurant === null` → add mode; otherwise edit. Keyed by
 * the parent so fields reset on open. Address has server-proxied Google Places
 * autocomplete; save-time coordinate resolution mirrors the web exactly:
 *   picked suggestion → keep existing → clear-on-empty-address →
 *   forward-geocode changed free text (+ a Details call to warm the photo
 *   cache when the geocode resolves to a place id).
 * Add mode: POST (server strips coords + geocodes) then, when the client
 * resolved a googlePlaceId, PATCH {lat,lng,googlePlaceId} on the created row —
 * this also triggers the server's Google rating/hours/photo refresh.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Restaurant, type RestaurantInput, type RestaurantStatus } from '../../lib/api';
import { Button, Field, OfflineHint, Select, SheetPanel } from '../../components/ui';
import { colors, radius, type } from '../../lib/theme';
import { forwardGeocode, usePlacesAutocomplete } from './eatsGoogle';

const STATUS_OPTIONS: { value: RestaurantStatus; label: string }[] = [
  { value: 'want-to-try', label: 'Want to try' },
  { value: 'been', label: 'Been' },
];

// '0' sentinel → null on save (Select<T> needs string values).
const RATING_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'No rating' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

const PRICE_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'No price' },
  { value: '1', label: '$' },
  { value: '2', label: '$$' },
  { value: '3', label: '$$$' },
  { value: '4', label: '$$$$' },
];

export function RestaurantForm({
  tripId,
  restaurant,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  restaurant: Restaurant | null;
  online: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = restaurant !== null;
  const initialAddress = restaurant?.address ?? '';
  const [name, setName] = useState(restaurant?.name ?? '');
  const [cuisine, setCuisine] = useState(restaurant?.cuisine ?? '');
  const [address, setAddress] = useState(initialAddress);
  const [status, setStatus] = useState<RestaurantStatus>(restaurant?.status ?? 'want-to-try');
  const [rating, setRating] = useState<string>(restaurant?.rating != null ? String(restaurant.rating) : '0');
  const [price, setPrice] = useState<string>(
    restaurant?.priceLevel != null ? String(restaurant.priceLevel) : '0',
  );
  const [notes, setNotes] = useState(restaurant?.notes ?? '');
  /** Coordinates + place id captured when a Google suggestion is picked. */
  const [picked, setPicked] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { predictions, search, select, clear } = usePlacesAutocomplete();

  const locked = busy || !online;

  function handleAddressChange(value: string) {
    setAddress(value);
    setPicked(null); // editing the text invalidates any prior suggestion pick
    void search(value);
  }

  async function handlePick(placeId: string) {
    const filled = await select(placeId);
    if (!filled) return;
    if (!name.trim() && filled.name) setName(filled.name);
    if (filled.address) setAddress(filled.address);
    if (typeof filled.lat === 'number' && typeof filled.lng === 'number') {
      setPicked({ lat: filled.lat, lng: filled.lng, googlePlaceId: filled.googlePlaceId });
    }
    clear(); // hide the suggestion list once one is chosen
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return; // no-op on empty name (matches web)
    setBusy(true);
    setError(false);

    const trimmedAddress = address.trim();
    try {
      // Resolve coordinates: a picked suggestion already carries them; an
      // empty address clears any prior location; a changed free-text address
      // is best-effort forward-geocoded. An unchanged address keeps the
      // existing coords so editing other fields never drops the pin.
      let lat: number | null = picked?.lat ?? restaurant?.lat ?? null;
      let lng: number | null = picked?.lng ?? restaurant?.lng ?? null;
      let gpid: string | null = picked?.googlePlaceId ?? restaurant?.googlePlaceId ?? null;
      if (!trimmedAddress) {
        lat = null;
        lng = null;
        gpid = null;
      } else if (!picked && trimmedAddress !== initialAddress) {
        const geo = await forwardGeocode(trimmedAddress);
        lat = geo ? geo.lat : null;
        lng = geo ? geo.lng : null;
        gpid = geo?.googlePlaceId ?? null;
        // When the address resolves to a Google place, pull Details so its
        // photo is downloaded + cached (auto-fills the restaurant photo).
        if (gpid) {
          const details = await select(gpid);
          gpid = details?.googlePlaceId || gpid;
        }
      }

      const base: RestaurantInput = {
        name: trimmedName,
        cuisine: cuisine.trim() || null,
        status,
        rating: rating === '0' ? null : Number(rating),
        priceLevel: price === '0' ? null : Number(price),
        notes: notes.trim() || null,
        address: trimmedAddress || null,
      };

      if (isEdit) {
        await api.eats.update(tripId, restaurant.id, { ...base, lat, lng, googlePlaceId: gpid });
      } else {
        // POST strips coords (the server forward-geocodes the address). When
        // the client already resolved a place id, follow with a PATCH so the
        // exact pick wins and the server refreshes Google rating/hours/photo.
        const { restaurant: created } = await api.eats.create(tripId, base);
        if (gpid != null) {
          await api.eats.update(tripId, created.id, { lat, lng, googlePlaceId: gpid });
        }
      }
      onSaved();
    } catch {
      setBusy(false);
      setError(true);
    }
  }

  return (
    <SheetPanel style={styles.panel}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Couldn't save — please try again.</Text>
          </View>
        ) : null}

        <Field label="Name" value={name} onChangeText={setName} editable={!locked} autoFocus={!isEdit} />
        <Field label="Cuisine" value={cuisine} onChangeText={setCuisine} editable={!locked} />
        <Field
          label="Address"
          value={address}
          onChangeText={handleAddressChange}
          editable={!locked}
          placeholder="Search or type an address"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          Pick a suggestion, or just type an address. We'll map it for you.
        </Text>

        {predictions.length > 0 ? (
          <View style={styles.suggestions}>
            {predictions.map((p, i) => (
              <Pressable
                key={p.placeId}
                disabled={locked}
                onPress={() => void handlePick(p.placeId)}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  i < predictions.length - 1 && styles.suggestionDivider,
                  pressed && { backgroundColor: colors.accentTint },
                  locked && { opacity: 0.45 },
                ]}
              >
                <Text style={styles.suggestionText}>{p.description}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} disabled={locked} />
        <Select label="Rating" value={rating} options={RATING_OPTIONS} onChange={setRating} disabled={locked} />
        <Select label="Price" value={price} options={PRICE_OPTIONS} onChange={setPrice} disabled={locked} />
        <Field label="Notes" value={notes} onChangeText={setNotes} editable={!locked} multiline />

        {!online ? <OfflineHint /> : null}
      </ScrollView>

      {/* Pinned footer: Cancel/Save always visible, never scrolls away. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} busy={busy} disabled={!online} style={{ flex: 1 }} />
      </View>
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  panel: { maxHeight: '85%' },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: 4 },

  errorBox: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { ...type.caption, color: colors.danger },

  hint: { marginTop: 6, ...type.caption, color: colors.sub },

  suggestions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 9 },
  suggestionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { ...type.body, color: colors.ink },

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
