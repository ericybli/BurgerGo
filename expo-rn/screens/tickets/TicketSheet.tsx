/**
 * Create / edit a ticket (reservation). Mirrors web components/tickets/TicketSheet.tsx:
 * attachments (images / PDFs, multiple) are picked into a pending list and
 * uploaded AFTER the ticket row saves — one submit covers everything. Edit mode
 * also lists + deletes existing files immediately (sheet stays open).
 *
 * Render inside <Sheet> with a `key` of the ticket id (or 'new') so the form
 * state resets on every open, matching the web's key-remount.
 */
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { FileText, Image as ImageIcon, X } from 'lucide-react-native';
import { api, type Ticket, type TicketFile } from '../../lib/api';
import { colors, font, radius, type } from '../../lib/theme';
import { Button, OfflineHint } from '../../components/ui';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // server cap: 15 MB per file

// Exact strings from web messages/en.json → tickets.*
const STR = {
  newTitle: 'New ticket',
  editTitle: 'Edit ticket',
  titleLabel: 'Title',
  dateLabel: 'Date',
  timeLabel: 'Time',
  locationLabel: 'Location',
  noteLabel: 'Note',
  filesLabel: 'Attachments',
  filesHint: 'Images or PDFs — booking confirmations, QR codes.',
  removeFile: 'Remove file',
  badFileType: 'Only images and PDFs are supported.',
  titleRequired: 'Add a title for this ticket.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  saveFailed: "Couldn't save. Try again.",
};

type PendingFile = { uri: string; name: string; type: string };

/** Map backend upload error codes to inline messages (web shows generic saveFailed). */
function friendlyError(e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  if (code.includes('too_large')) return 'That file is too big (max 15 MB).';
  if (code.includes('too_many')) return 'Max reached (12 files per ticket).';
  if (code.includes('unsupported_type')) return STR.badFileType;
  return STR.saveFailed;
}

export function TicketSheet({
  tripId,
  ticket,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  /** Present → edit mode; null → create mode. */
  ticket: Ticket | null;
  online: boolean;
  onClose: () => void;
  /** Reload the parent list; must NOT close the sheet (called mid-edit on file deletes). */
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!ticket;
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [date, setDate] = useState(ticket?.date ?? '');
  const [time, setTime] = useState(ticket?.time ?? '');
  const [location, setLocation] = useState(ticket?.location ?? '');
  const [note, setNote] = useState(ticket?.note ?? '');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<TicketFile[]>(ticket?.files ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const disabled = !online || saving;

  /** Append picked files, dropping wrong types / oversized ones with an inline error. */
  function appendPicked(assets: { uri: string; name: string; type: string; size?: number }[]) {
    let badType = false;
    let tooBig = false;
    const ok: PendingFile[] = [];
    for (const a of assets) {
      if (!(a.type === 'application/pdf' || a.type.startsWith('image/'))) {
        badType = true;
        continue;
      }
      if (a.size != null && a.size > MAX_FILE_BYTES) {
        tooBig = true;
        continue;
      }
      ok.push({ uri: a.uri, name: a.name, type: a.type });
    }
    if (badType) setError(STR.badFileType);
    else if (tooBig) setError('That file is too big (max 15 MB).');
    if (ok.length > 0) setPending((p) => [...p, ...ok]);
  }

  async function addPhotos() {
    setError(null);
    // Parity (spec line 64): the web uploads the picked file's exact bytes — QR
    // codes must stay pixel-identical. So: no `quality` (defaults to max; iOS
    // passes PNG/BMP through untouched) and ask iOS for the asset's *current*
    // representation to avoid transcoding. RN-web returns the original File
    // blob unmodified either way.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (picked.canceled) return;
    appendPicked(
      picked.assets.map((a, i) => {
        // iOS photo-library picks often lack a real filename; derive the
        // fallback extension from the actual mime so PNGs aren't labeled .jpg.
        const mime = a.mimeType ?? 'image/jpeg';
        const ext = (mime.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
        return {
          uri: a.uri,
          name: a.fileName ?? `photo-${Date.now()}-${i}.${ext}`,
          type: mime,
          size: a.fileSize ?? undefined,
        };
      }),
    );
  }

  async function addPdfs() {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    appendPicked(
      picked.assets.map((a) => ({
        uri: a.uri,
        name: a.name || 'attachment.pdf',
        type: a.mimeType ?? (a.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : ''),
        size: a.size,
      })),
    );
  }

  /** Existing attachments delete immediately (server call); the sheet stays open. */
  async function removeExisting(fileId: string) {
    setError(null);
    try {
      await api.tickets.removeFile(fileId);
      setExistingFiles((fs) => fs.filter((f) => f.id !== fileId));
      onSaved();
    } catch {
      setError(STR.saveFailed);
    }
  }

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(STR.titleRequired);
      return;
    }
    // RN replaces the web's native date/time inputs with free text — pre-validate
    // with the server's regexes so a 400 doesn't surface as the generic error.
    const dateValue = date.trim();
    const timeValue = time.trim();
    if (dateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      setError('Use YYYY-MM-DD for the date.');
      return;
    }
    if (timeValue && !/^\d{2}:\d{2}$/.test(timeValue)) {
      setError('Use HH:MM for the time.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: trimmed,
        date: dateValue || null,
        time: timeValue || null,
        location: location.trim() || null,
        note: note.trim() || null,
      };
      const savedId = isEdit
        ? (await api.tickets.update(tripId, ticket!.id, payload)).ticket.id
        : (await api.tickets.create(tripId, payload)).ticket.id;

      // Upload pending attachments sequentially; stop + surface the first failure.
      for (const file of pending) {
        await api.tickets.uploadFile(tripId, savedId, file);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
      onSaved(); // partial uploads may have landed — refresh the list
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.panel}>
      <View style={s.handle} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.panelContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.sheetTitle}>{isEdit ? STR.editTitle : STR.newTitle}</Text>

      {error ? <Text style={s.errorBanner}>{error}</Text> : null}

      <FormField label={STR.titleLabel} value={title} onChangeText={setTitle} editable={!disabled} />
      <FormField
        label={STR.dateLabel}
        value={date}
        onChangeText={setDate}
        editable={!disabled}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        style={s.tabular}
      />
      <FormField
        label={STR.timeLabel}
        value={time}
        onChangeText={setTime}
        editable={!disabled}
        placeholder="HH:MM"
        autoCapitalize="none"
        style={s.tabular}
      />
      <FormField
        label={STR.locationLabel}
        value={location}
        onChangeText={setLocation}
        editable={!disabled}
      />
      <FormField
        label={STR.noteLabel}
        value={note}
        onChangeText={setNote}
        editable={!disabled}
        multiline
      />

      <Text style={s.fieldLabel}>{STR.filesLabel}</Text>
      {existingFiles.length > 0 ? (
        <View style={s.fileList}>
          {existingFiles.map((f) => (
            <FileRow
              key={f.id}
              name={f.name}
              isPdf={f.mime === 'application/pdf'}
              pending={false}
              removeDisabled={disabled}
              onRemove={() => void removeExisting(f.id)}
            />
          ))}
        </View>
      ) : null}
      {pending.length > 0 ? (
        <View style={s.fileList}>
          {pending.map((f, i) => (
            <FileRow
              key={`${f.name}-${i}`}
              name={f.name}
              isPdf={f.type === 'application/pdf'}
              pending
              removeDisabled={false}
              onRemove={() => setPending((p) => p.filter((_, j) => j !== i))}
            />
          ))}
        </View>
      ) : null}

      <View style={s.addFilesRow}>
        <PickButton label="Add photo" disabled={disabled} onPress={() => void addPhotos()} />
        <PickButton label="Add PDF" disabled={disabled} onPress={() => void addPdfs()} />
      </View>
      <Text style={s.hint}>{STR.filesHint}</Text>

        {!online ? <OfflineHint /> : null}
      </ScrollView>

      {/* Pinned footer: Save/Cancel always visible, never scrolls away. */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button
          title={saving ? STR.saving : STR.save}
          onPress={() => void handleSave()}
          disabled={disabled}
          style={{ flex: 1 }}
        />
        <Button title={STR.cancel} variant="secondary" onPress={onClose} style={s.cancelBtn} />
      </View>
    </View>
  );
}

// --- Local form bits (Atlas: MICRO uppercase faint labels — the shared Field
// uses a different label recipe, so the input is rebuilt here) ---------------

function FormField({ label, style, ...inputProps }: { label: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[
          s.input,
          inputProps.multiline && s.inputMultiline,
          focused && s.inputFocused,
          inputProps.editable === false && s.inputDisabled,
          style,
        ]}
      />
    </View>
  );
}

/** One attachment row: existing = solid hairline + accent icon; pending = dashed + faint. */
function FileRow({
  name,
  isPdf,
  pending,
  removeDisabled,
  onRemove,
}: {
  name: string;
  isPdf: boolean;
  pending: boolean;
  removeDisabled: boolean;
  onRemove: () => void;
}) {
  const Icon = isPdf ? FileText : ImageIcon;
  return (
    <View style={[s.fileRow, pending && s.fileRowPending]}>
      <Icon size={15} strokeWidth={1.75} color={pending ? colors.faint : colors.accent} />
      <Text style={[s.fileName, pending && s.fileNamePending]} numberOfLines={1}>
        {name}
      </Text>
      <Pressable
        onPress={onRemove}
        disabled={removeDisabled}
        accessibilityLabel={STR.removeFile}
        hitSlop={6}
        style={({ pressed }) => [s.fileRemove, pressed && { backgroundColor: colors.line }]}
      >
        <X size={13} strokeWidth={2.2} color={removeDisabled ? colors.line : colors.faint} />
      </Pressable>
    </View>
  );
}

function PickButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.pickBtn,
        pressed && !disabled && { backgroundColor: colors.accentTint },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[s.pickBtnText, disabled && { color: colors.faint }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Column panel: fixed handle on top, flexible scroll in the middle, pinned
  // footer at the bottom (caps at 85% so the footer never leaves the screen).
  panel: {
    maxHeight: '85%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  scroll: { flexShrink: 1 },
  panelContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.chip,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    letterSpacing: -0.18,
    color: colors.ink,
    marginBottom: 12,
  },

  errorBanner: {
    ...type.caption,
    color: colors.danger,
    backgroundColor: 'rgba(179, 64, 44, 0.10)',
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },

  fieldLabel: {
    ...type.micro,
    color: colors.faint,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
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
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  inputDisabled: { opacity: 0.6 },
  tabular: { fontVariant: ['tabular-nums'] },

  fileList: { marginTop: 4, gap: 6, marginBottom: 2 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fileRowPending: { borderStyle: 'dashed' },
  fileName: { ...type.caption, fontFamily: font.semibold, color: colors.ink, flex: 1 },
  fileNamePending: { fontFamily: font.medium, color: colors.sub },
  fileRemove: {
    width: 24,
    height: 24,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addFilesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pickBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickBtnText: { ...type.label, color: colors.accent },
  hint: { ...type.caption, color: colors.faint, marginTop: 6 },

  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  cancelBtn: { width: 90 },
});
