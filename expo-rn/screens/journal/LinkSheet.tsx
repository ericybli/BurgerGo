/**
 * Add/edit reading-list link sheet, ported from
 * components/journal/LinkSheet.tsx. URL / Title / Note fields; OG preview on
 * URL blur — add mode + online + valid http(s) URL only ("Fetching preview…"
 * while pending, prefills the title only when still empty, keeps the returned
 * thumbnailPath for the save payload; failure or empty response →
 * "Couldn't fetch a preview — add the details yourself."). Edit mode
 * preserves the existing thumbnail untouched and adds a single-tap Delete.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type SavedLink } from '../../lib/api';
import { colors, type } from '../../lib/theme';
import { isHttpUrl } from '../../lib/journalView';
import { Button } from '../../components/ui';
import { ErrorBanner, FormField } from './formBits';
import { STR } from './strings';

export function LinkSheet({
  tripId,
  link,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  /** Present → edit mode; null → add mode. */
  link: SavedLink | null;
  online: boolean;
  onClose: () => void;
  /** Reloads the owner; the sheet closes itself after save/delete. */
  onSaved: () => void;
}) {
  const isEdit = link !== null;
  const [url, setUrl] = useState(link?.url ?? '');
  const [title, setTitle] = useState(link?.title ?? '');
  const [note, setNote] = useState(link?.note ?? '');
  // Thumbnail path is preserved in edit mode; refreshed by a preview in add mode.
  const [thumbnail, setThumbnail] = useState<string | null>(link?.thumbnail ?? null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const editable = online && !pending;

  async function handleUrlBlur() {
    // Preview only in add mode, online, with a valid http(s) URL.
    if (isEdit || !online) return;
    const value = url.trim();
    if (!isHttpUrl(value)) return;
    setPreviewing(true);
    setPreviewFailed(false);
    try {
      const data = await api.journal.linkPreview(tripId, value);
      if (data.title && title.trim() === '') setTitle(data.title);
      if (data.thumbnailPath) setThumbnail(data.thumbnailPath);
      if (!data.title && !data.thumbnailPath) setPreviewFailed(true);
    } catch {
      setPreviewFailed(true);
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    setError(null);
    const value = url.trim();
    if (!isHttpUrl(value)) {
      setError(STR.invalidUrl);
      return;
    }
    const payload = {
      url: value,
      title: title.trim() === '' ? null : title.trim(),
      note: note.trim() === '' ? null : note.trim(),
      thumbnail,
    };
    setPending(true);
    try {
      if (isEdit && link) await api.journal.updateLink(tripId, link.id, payload);
      else await api.journal.addLink(tripId, payload);
      onSaved();
      onClose();
    } catch {
      setPending(false);
      setError(STR.saveFailed);
    }
  }

  async function handleDelete() {
    if (!link) return;
    setError(null);
    setPending(true);
    try {
      await api.journal.deleteLink(tripId, link.id);
      onSaved();
      onClose();
    } catch {
      setPending(false);
      setError(STR.mutationFailed);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {error ? <ErrorBanner text={error} style={ls.bannerGap} /> : null}
      {!online ? <Text style={ls.offlineHint}>{STR.offlineHint}</Text> : null}

      <FormField
        label={STR.urlLabel}
        value={url}
        onChangeText={setUrl}
        onBlur={handleUrlBlur}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="url"
        placeholder="https://…"
        autoFocus={!isEdit}
      />
      {previewing ? <Text style={ls.previewMsg}>{STR.previewFetching}</Text> : null}
      {previewFailed ? <Text style={ls.previewMsg}>{STR.previewFailed}</Text> : null}

      <FormField label={STR.titleLabel} value={title} onChangeText={setTitle} editable={editable} />
      <FormField label={STR.noteLabel} value={note} onChangeText={setNote} editable={editable} />

      <View style={ls.btnRow}>
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
          title={STR.deleteLink}
          variant="ghost"
          onPress={handleDelete}
          disabled={!online || pending}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </ScrollView>
  );
}

const ls = StyleSheet.create({
  bannerGap: { marginTop: 8 },
  offlineHint: { marginTop: 8, ...type.caption, color: colors.sub },
  previewMsg: { marginTop: 4, ...type.caption, color: colors.faint },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
});
