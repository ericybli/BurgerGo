/**
 * Add/edit journal entry bottom sheet, ported from
 * components/journal/EntrySheet.tsx. Title (required) / Date (defaults to
 * today in add mode AND when the edited entry has no date; cleared → null) /
 * 8-row Entry body with a Formatting toolbar (Bold/Italic/Heading/List/Link —
 * wraps the selection or inserts at the caret, then restores selection).
 * Edit mode adds the photo gallery (✕ delete, single tap) + single-image
 * "Add a photo" picker and a two-tap Delete entry; add mode shows the
 * "Save the entry first" hint instead. Photo mutations refresh the owner
 * immediately (sheet stays open).
 */
import { useRef, useState } from 'react';
import {
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import { api, type JournalEntry } from '../../lib/api';
import { colors, font, radius, type } from '../../lib/theme';
import { todayLocal } from '../../lib/days';
import { Button, DateField } from '../../components/ui';
import { ErrorBanner, FormField, OutlineAccentButton } from './formBits';
import { PhotoGallery } from './PhotoGallery';
import { pickImages, uploadErrorMessage } from './photoUpload';
import { STR } from './strings';

/** One markdown toolbar action: wrap the selection (or insert at the caret). */
type MdAction = { id: string; label: string; before: string; after: string };
const MD_ACTIONS: MdAction[] = [
  { id: 'bold', label: STR.mdBold, before: '**', after: '**' },
  { id: 'italic', label: STR.mdItalic, before: '*', after: '*' },
  { id: 'heading', label: STR.mdHeading, before: '# ', after: '' },
  { id: 'list', label: STR.mdList, before: '- ', after: '' },
  { id: 'link', label: STR.mdLink, before: '[', after: '](https://)' },
];

export function EntrySheet({
  tripId,
  entry,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  /** Present → edit mode; null → add mode. */
  entry: JournalEntry | null;
  online: boolean;
  onClose: () => void;
  /** Reloads the owner; the sheet closes itself after save/delete only. */
  onSaved: () => void;
}) {
  const isEdit = entry !== null;
  const [title, setTitle] = useState(entry?.title ?? '');
  // Web parity: default to today in add mode and when the entry has no date.
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? todayLocal());
  const [body, setBody] = useState(entry?.body ?? '');
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Body selection bookkeeping for the markdown toolbar.
  const bodyRef = useRef<TextInput>(null);
  const selRef = useRef({ start: (entry?.body ?? '').length, end: (entry?.body ?? '').length });
  // Set transiently to programmatically restore the selection, then released
  // on the next user-driven selection change so typing stays uncontrolled.
  const [forcedSelection, setForcedSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const [bodyFocused, setBodyFocused] = useState(false);

  const editable = online && !pending;

  function onBodySelectionChange(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) {
    selRef.current = e.nativeEvent.selection;
    if (forcedSelection) setForcedSelection(undefined);
  }

  function applyMarkdown(action: MdAction) {
    const start = Math.min(selRef.current.start, body.length);
    const end = Math.min(Math.max(selRef.current.end, start), body.length);
    const selected = body.slice(start, end);
    setBody(body.slice(0, start) + action.before + selected + action.after + body.slice(end));
    const caretStart = start + action.before.length;
    const nextSel = { start: caretStart, end: caretStart + selected.length };
    selRef.current = nextSel;
    bodyRef.current?.focus();
    setForcedSelection(nextSel);
  }

  async function save() {
    setError(null);
    const trimmed = title.trim();
    if (trimmed === '') {
      setError(STR.titleRequired);
      return;
    }
    const date = entryDate.trim();
    const payload = { title: trimmed, body, entryDate: date === '' ? null : date };
    setPending(true);
    try {
      if (isEdit && entry) await api.journal.updateEntry(tripId, entry.id, payload);
      else await api.journal.addEntry(tripId, payload);
      onSaved();
      onClose();
    } catch {
      setPending(false);
      setError(STR.saveFailed);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api.journal.deleteEntry(tripId, entry.id);
      onSaved();
      onClose();
    } catch {
      setPending(false);
      setArmed(false);
      setError(STR.mutationFailed);
    }
  }

  async function addPhoto() {
    if (!entry) return;
    setPhotoError(null);
    const [file] = await pickImages(false);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(STR.photoNotImage);
      return;
    }
    setUploading(true);
    try {
      await api.photos.upload(tripId, 'journal', entry.id, file);
      onSaved(); // owner reloads → gallery refreshes; sheet stays open
    } catch (e) {
      setPhotoError(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    setPhotoError(null);
    try {
      await api.photos.remove(photoId);
      onSaved();
    } catch {
      setPhotoError(STR.photoUploadFailed);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {error ? <ErrorBanner text={error} style={es.bannerGap} /> : null}
      {!online ? <Text style={es.offlineHint}>{STR.offlineHint}</Text> : null}

      <FormField
        label={STR.titleLabel}
        value={title}
        onChangeText={setTitle}
        editable={editable}
        autoFocus={!isEdit}
      />
      <DateField
        label={STR.dateLabel}
        labelStyle={es.pickerLabel}
        containerStyle={es.field}
        value={entryDate}
        onChange={setEntryDate}
        disabled={!editable}
      />

      <View style={es.field}>
        <Text style={es.micro}>{STR.bodyLabel}</Text>
        <View style={es.toolbar} accessibilityRole="toolbar" accessibilityLabel={STR.mdToolbar}>
          {MD_ACTIONS.map((a) => (
            <Pressable
              key={a.id}
              disabled={!editable}
              onPress={() => applyMarkdown(a)}
              style={({ pressed }) => [
                es.toolChip,
                pressed && { backgroundColor: colors.line },
                !editable && { opacity: 0.4 },
              ]}
            >
              <Text style={es.toolChipText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          ref={bodyRef}
          multiline
          value={body}
          onChangeText={setBody}
          editable={editable}
          selection={forcedSelection}
          onSelectionChange={onBodySelectionChange}
          onFocus={() => setBodyFocused(true)}
          onBlur={() => setBodyFocused(false)}
          placeholderTextColor={colors.faint}
          style={[
            es.bodyInput,
            bodyFocused && { borderColor: colors.accent },
            !editable && es.bodyInputDisabled,
          ]}
        />
      </View>

      {photoError ? <ErrorBanner text={photoError} style={es.bannerGapTop} /> : null}

      {isEdit && entry ? (
        <View>
          <PhotoGallery photos={entry.photos} onDelete={deletePhoto} deleteDisabled={!online} />
          {!online ? <Text style={es.photoCaption}>{STR.addPhotoOffline}</Text> : null}
          <View style={{ marginTop: 12 }}>
            <OutlineAccentButton
              title={uploading ? STR.uploadingPhoto : STR.addPhoto}
              onPress={addPhoto}
              disabled={!online || uploading}
            />
          </View>
        </View>
      ) : (
        <Text style={es.photoCaption}>{STR.photosAfterSaveHint}</Text>
      )}

      <View style={es.btnRow}>
        <Button
          title={STR.save}
          onPress={save}
          disabled={!online}
          busy={pending}
          style={{ flex: 1 }}
        />
        <Button title={STR.cancel} variant="secondary" onPress={onClose} style={{ width: 90 }} />
      </View>

      {isEdit ? (
        <Button
          title={armed ? STR.confirmDelete : STR.deleteEntry}
          variant={armed ? 'danger' : 'ghost'}
          onPress={handleDelete}
          disabled={!online || pending}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </ScrollView>
  );
}

const es = StyleSheet.create({
  bannerGap: { marginTop: 8 },
  bannerGapTop: { marginTop: 12 },
  offlineHint: { marginTop: 8, ...type.caption, color: colors.sub },

  field: { marginTop: 12 },
  micro: { ...type.micro, color: colors.faint, textTransform: 'uppercase' },
  // DateField label: journal micro-uppercase look with the picker's 4px gap to the control.
  pickerLabel: { ...type.micro, color: colors.faint, textTransform: 'uppercase', marginBottom: 4 },
  toolbar: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  toolChip: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  toolChipText: { fontSize: 12, fontFamily: font.semibold, color: colors.sub },
  bodyInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 24,
    color: colors.ink,
    fontFamily: font.regular,
    minHeight: 192, // ~8 rows at 24px leading (web rows={8})
    textAlignVertical: 'top',
  },
  bodyInputDisabled: { opacity: 0.6 }, // web parity: disabled:opacity-60

  photoCaption: { marginTop: 12, ...type.caption, color: colors.faint },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
});
