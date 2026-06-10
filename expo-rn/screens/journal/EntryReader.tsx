/**
 * Full-view entry reader (replaces the journal list, like a detail page).
 * Ported from components/journal/EntryReader.tsx: Back (hairline ghost) /
 * Edit (accent text, offline-disabled) header, title, "YYYY-MM-DD · Weekday"
 * date line, markdown body, read-only photo gallery, and a bottom two-tap
 * delete ("Delete entry" → "Tap again to delete") with an error banner that
 * re-disarms on failure.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { JournalEntry } from '../../lib/api';
import { colors, radius, type } from '../../lib/theme';
import { entryDateLabel } from '../../lib/journalView';
import { ErrorBanner } from './formBits';
import { MarkdownText } from './MarkdownText';
import { PhotoGallery } from './PhotoGallery';
import { STR } from './strings';

export function EntryReader({
  entry,
  online,
  onBack,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  online: boolean;
  onBack: () => void;
  onEdit: () => void;
  /** Deletes this entry; the owner closes the reader + reloads on success. */
  onDelete: () => Promise<void>;
}) {
  // Two-tap delete: first tap arms, second tap deletes; failure re-disarms.
  const [armed, setArmed] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setDeleteError(false);
    setPending(true);
    try {
      await onDelete();
    } catch {
      setDeleteError(true);
      setArmed(false);
      setPending(false);
    }
  }

  const deleteDisabled = !online || pending;

  return (
    <View style={rd.root}>
      <View style={rd.header}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [rd.backBtn, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={rd.backText}>{STR.back}</Text>
        </Pressable>
        <Pressable
          hitSlop={8}
          disabled={!online}
          onPress={onEdit}
          style={({ pressed }) => [pressed && { opacity: 0.7 }, !online && { opacity: 0.4 }]}
        >
          <Text style={rd.editText}>{STR.edit}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={rd.body}>
        <Text style={rd.title}>{entry.title}</Text>
        {entry.entryDate ? <Text style={rd.date}>{entryDateLabel(entry.entryDate)}</Text> : null}

        {entry.body.trim() !== '' ? (
          <View style={rd.markdown}>
            <MarkdownText source={entry.body} />
          </View>
        ) : null}

        {/* Read-only gallery: no onDelete → ✕ buttons hidden. */}
        <PhotoGallery photos={entry.photos} />

        {deleteError ? <ErrorBanner text={STR.mutationFailed} style={rd.errorGap} /> : null}
        <Pressable
          disabled={deleteDisabled}
          onPress={handleDelete}
          style={({ pressed }) => [
            rd.deleteBtn,
            armed && rd.deleteBtnArmed,
            deleteDisabled && rd.deleteBtnDisabled,
            pressed && !deleteDisabled && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              rd.deleteText,
              armed && rd.deleteTextArmed,
              deleteDisabled && rd.deleteTextDisabled,
            ]}
          >
            {armed ? STR.confirmDelete : STR.deleteEntry}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const rd = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backText: { ...type.label, color: colors.ink },
  editText: { ...type.label, color: colors.accent, paddingHorizontal: 12, paddingVertical: 6 },

  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 96 },
  title: { ...type.title, color: colors.ink },
  date: { marginTop: 6, ...type.caption, color: colors.faint, fontVariant: ['tabular-nums'] },
  markdown: { marginTop: 20 },

  errorGap: { marginTop: 24 },
  deleteBtn: {
    marginTop: 24,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteBtnArmed: { backgroundColor: colors.danger },
  deleteBtnDisabled: { backgroundColor: colors.surface },
  deleteText: { ...type.label, color: colors.danger },
  deleteTextArmed: { color: colors.white },
  deleteTextDisabled: { color: colors.faint },
});
