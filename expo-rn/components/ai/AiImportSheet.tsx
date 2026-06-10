/**
 * AI import sheet — port of web components/ai/AiImportSheet.tsx. Screenshots
 * and/or pasted text → AI extraction → editable preview (type toggle, name,
 * address, per-row remove) → create restaurants + saved places. Key-remount
 * per open (the host passes a fresh `key`) so all state resets, like the web.
 *
 * Images: web downscales to ≤1024px JPEG q0.7 client-side; expo-image-picker
 * has no resize, so we lean on `quality` re-encoding to keep payloads small.
 * Server caps at 8 images (MAX_IMAGES) and 20k chars of text.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../lib/api';
import type { ImportPreviewItem } from '../../lib/api/types';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
import { Button, Sheet } from '../ui';

/** Server-side cap (app/_actions/aiImport.ts MAX_IMAGES). */
const MAX_IMAGES = 8;

type Phase = 'input' | 'extracting' | 'preview' | 'creating' | 'done';
type Img = { id: string; dataUrl: string };
type Row = ImportPreviewItem & { id: string };

let seq = 0;
const uid = () => `ai${(seq += 1)}`;

/** Strings mirrored from web messages/en.json `aiImport.*`. */
const STR = {
  title: 'AI import',
  subtitle: 'Add screenshots of a guide — or paste text — and AI pulls out the places & restaurants.',
  addImages: 'Add images',
  imagesHint: (count: number) => `${count}/${MAX_IMAGES} images`,
  textPlaceholder: 'Paste text from a guide, article, or message…',
  extract: 'Extract places',
  extracting: 'Reading…',
  nothingFound: "Couldn't find any places. Try clearer images or more text.",
  extractError: 'Something went wrong. Please try again.',
  reviewTitle: (count: number) => `Found ${count} — review & create`,
  typeRestaurant: 'Restaurant',
  typePlace: 'Saved place',
  namePlaceholder: 'Name',
  addressPlaceholder: 'Address',
  unmatched: "⚠ Not found on Google — won't show on the map",
  removeItem: 'Remove',
  back: 'Back',
  create: (count: number) => `Create ${count}`,
  creating: 'Creating…',
  createError: "Couldn't create those. Please try again.",
  doneTitle: 'Imported!',
  doneSummary: (restaurants: number, places: number) =>
    `Added ${restaurants} to Eats and ${places} to Saved.`,
  close: 'Close',
};

/** Staggered fade-up (web `animate-fade-up` with per-row animationDelay). */
function FadeUp({ delay, children }: { delay: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      delay,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Hairline input that gains an accent border on focus (web focus ring). */
function SheetInput(props: TextInputProps) {
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
      style={[s.input, focused && { borderColor: colors.accent }, props.style]}
    />
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={s.error}>
      {children}
    </Text>
  );
}

export function AiImportSheet({
  visible,
  tripId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  tripId: string;
  onClose: () => void;
  /** Called after a successful create so the host can refresh its data. */
  onCreated?: () => void;
}) {
  const online = useOnline();
  const { height: windowHeight } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('input');
  const [images, setImages] = useState<Img[]>([]);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ restaurants: number; places: number } | null>(null);

  const pending = phase === 'extracting' || phase === 'creating';
  const canExtract = online && !pending && (images.length > 0 || text.trim().length > 0);

  async function pickImages() {
    const room = Math.max(0, MAX_IMAGES - images.length);
    if (room <= 0) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: 0.6,
        base64: true,
      });
      if (res.canceled) return;
      const added: Img[] = [];
      for (const asset of (res.assets ?? []).slice(0, room)) {
        // Web picker returns a data: URL in `uri`; native returns base64 separately.
        const dataUrl = asset.uri.startsWith('data:')
          ? asset.uri
          : asset.base64
            ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
            : null;
        if (dataUrl) added.push({ id: uid(), dataUrl });
      }
      if (added.length) setImages((cur) => [...cur, ...added]);
    } catch {
      // skip unreadable images (web parity: silent skip)
    }
  }

  async function extract() {
    setError(null);
    setPhase('extracting');
    try {
      const { items } = await api.aiImport.extract(tripId, {
        images: images.map((i) => i.dataUrl),
        text,
      });
      if (items.length === 0) {
        setError(STR.nothingFound);
        setPhase('input');
        return;
      }
      setRows(items.map((it) => ({ ...it, id: uid() })));
      setPhase('preview');
    } catch {
      setError(STR.extractError);
      setPhase('input');
    }
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((cur) => cur.filter((r) => r.id !== id));
  }

  async function create() {
    setError(null);
    setPhase('creating');
    try {
      const res = await api.aiImport.create(
        tripId,
        rows.map((r) => ({
          type: r.type,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          googlePlaceId: r.googlePlaceId,
          cuisine: r.cuisine,
          category: r.category,
          notes: r.notes,
        })),
      );
      setResult(res);
      setPhase('done');
      onCreated?.();
    } catch {
      setError(STR.createError);
      setPhase('preview');
    }
  }

  const reviewing = phase === 'preview' || phase === 'creating';

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={[s.panel, { maxHeight: windowHeight * 0.88 }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>{phase === 'done' ? STR.doneTitle : STR.title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={STR.close}
            onPress={onClose}
            hitSlop={6}
            style={({ pressed }) => [
              s.closeChip,
              pressed && { backgroundColor: colors.surface, transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'done' && result ? (
            /* --- Done --- */
            <View style={{ paddingVertical: 24 }}>
              <Text style={s.doneBody}>{STR.doneSummary(result.restaurants, result.places)}</Text>
              <Button title={STR.close} onPress={onClose} style={{ marginTop: 20 }} />
            </View>
          ) : reviewing ? (
            /* --- Preview --- */
            <>
              <Text style={s.caption}>{STR.reviewTitle(rows.length)}</Text>
              <View style={{ marginTop: 12, gap: 12 }}>
                {rows.map((r, i) => (
                  <FadeUp key={r.id} delay={Math.min(i, 6) * 40}>
                    <View style={s.rowCard}>
                      <View style={s.rowTop}>
                        <View style={s.segTrack} accessibilityRole="radiogroup">
                          {(['restaurant', 'place'] as const).map((tp) => {
                            const active = r.type === tp;
                            return (
                              <Pressable
                                key={tp}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                onPress={() => updateRow(r.id, { type: tp })}
                                style={[s.segItem, active && s.segItemActive]}
                              >
                                <Text style={[s.segText, active && s.segTextActive]}>
                                  {tp === 'restaurant' ? STR.typeRestaurant : STR.typePlace}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={STR.removeItem}
                          onPress={() => removeRow(r.id)}
                          hitSlop={6}
                          style={({ pressed }) => [
                            s.closeChip,
                            pressed && { backgroundColor: colors.surface, transform: [{ scale: 0.95 }] },
                          ]}
                        >
                          <Text style={s.closeX}>✕</Text>
                        </Pressable>
                      </View>
                      <SheetInput
                        value={r.name}
                        accessibilityLabel={STR.namePlaceholder}
                        placeholder={STR.namePlaceholder}
                        onChangeText={(v) => updateRow(r.id, { name: v })}
                        style={s.nameInput}
                      />
                      <SheetInput
                        value={r.address ?? ''}
                        accessibilityLabel={STR.addressPlaceholder}
                        placeholder={STR.addressPlaceholder}
                        onChangeText={(v) => updateRow(r.id, { address: v })}
                        style={s.addressInput}
                      />
                      {!r.resolved ? <Text style={s.unmatched}>{STR.unmatched}</Text> : null}
                    </View>
                  </FadeUp>
                ))}
              </View>

              {error ? <ErrorText>{error}</ErrorText> : null}

              <View style={s.footerRow}>
                <Button
                  title={STR.back}
                  variant="secondary"
                  onPress={() => setPhase('input')}
                  disabled={pending}
                />
                <Button
                  title={phase === 'creating' ? STR.creating : STR.create(rows.length)}
                  onPress={create}
                  disabled={pending || rows.length === 0 || !online}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            /* --- Input --- */
            <>
              <Text style={s.caption}>{STR.subtitle}</Text>

              {images.length > 0 ? (
                <View style={s.thumbGrid}>
                  {images.map((img) => (
                    <View key={img.id} style={s.thumbCell}>
                      <View>
                        <Image source={{ uri: img.dataUrl }} style={s.thumb} resizeMode="cover" />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={STR.removeItem}
                          onPress={() => setImages((cur) => cur.filter((i) => i.id !== img.id))}
                          hitSlop={6}
                          style={({ pressed }) => [s.thumbX, pressed && { transform: [{ scale: 0.95 }] }]}
                        >
                          <Text style={s.thumbXText}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={STR.addImages}
                onPress={pickImages}
                disabled={images.length >= MAX_IMAGES || pending}
                style={({ pressed }) => [s.picker, pressed && { transform: [{ scale: 0.99 }] }]}
              >
                <Text style={s.pickerLabel}>{STR.addImages}</Text>
                <Text style={s.pickerHint}>{STR.imagesHint(images.length)}</Text>
              </Pressable>

              <SheetInput
                multiline
                value={text}
                placeholder={STR.textPlaceholder}
                onChangeText={setText}
                style={s.textArea}
              />

              {error ? <ErrorText>{error}</ErrorText> : null}

              <Button
                title={phase === 'extracting' ? STR.extracting : STR.extract}
                onPress={extract}
                disabled={!canExtract}
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.chip,
    backgroundColor: colors.line,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: { fontFamily: font.bold, fontSize: 18, letterSpacing: -0.18, color: colors.ink },
  closeChip: { padding: 4, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
  closeX: { color: colors.faint, fontSize: 15, fontFamily: font.medium },
  body: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12 },

  caption: { ...type.caption, color: colors.sub },
  error: { marginTop: 12, ...type.caption, color: colors.danger },

  // input phase
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -4 },
  thumbCell: { width: '25%', padding: 4 },
  thumb: { width: '100%', height: 64, borderRadius: radius.control },
  thumbX: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(27, 31, 28, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbXText: { color: colors.white, fontSize: 11, fontFamily: font.medium },
  picker: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.bg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pickerLabel: { ...type.label, color: colors.accent },
  pickerHint: { ...type.caption, color: colors.faint, marginLeft: 8 },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.ink,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },

  // preview phase
  rowCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  segTrack: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    padding: 3,
    alignSelf: 'flex-start',
  },
  segItem: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  segItemActive: {
    backgroundColor: colors.bg,
    // Atlas thumb shadow (the one allowed shadow).
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: { ...type.label, color: colors.sub },
  segTextActive: { color: colors.ink },
  nameInput: { marginTop: 8, fontFamily: font.medium },
  addressInput: { marginTop: 8, fontSize: 13, color: colors.sub },
  unmatched: { marginTop: 4, ...type.caption, color: colors.faint },
  footerRow: { marginTop: 16, flexDirection: 'row', gap: 12 },

  // done phase
  doneBody: { ...type.body, fontSize: 13.5, color: colors.ink, textAlign: 'center' },
});
