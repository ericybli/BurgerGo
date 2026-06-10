/**
 * Trip-screen header chrome — mirrors web components/TripHeader.tsx:
 * - headerTitle: pressable trip name (19 bold) over a tabular-nums
 *   "MMM d – MMM d" caption; tap opens the RenameSheet (web RenameSheet.tsx).
 * - headerRight: 36px round accent-tint chip with a teal Sparkles icon that
 *   opens the AI-import sheet. Both sheets key-remount per open.
 */
import { useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { api } from '../lib/api';
import { colors, font, type } from '../lib/theme';
import { Button, Field, Sheet, SheetPanel } from '../components/ui';
import { AiImportSheet } from '../components/ai/AiImportSheet';
import { formatMonthDay } from '../screens/home/tripDates';

/** "Sep 4 – Sep 12" (web TripShellClient formatSubtitle: en dash with spaces). */
function formatSubtitle(startDate: string, endDate: string): string {
  return `${formatMonthDay(startDate)} – ${formatMonthDay(endDate)}`;
}

// --- Rename sheet (web RenameSheet.tsx + messages renameSheet.*) -------------

function RenameSheet({
  visible,
  tripId,
  currentName,
  onClose,
  onRenamed,
}: {
  visible: boolean;
  tripId: string;
  currentName: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Please enter a trip name.');
      return;
    }
    setPending(true);
    try {
      await api.trips.update(tripId, { name: trimmed });
      onRenamed(trimmed);
      onClose();
    } catch {
      setError("Couldn't save — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetPanel title="Rename trip">
        <Field label="Trip name" value={name} onChangeText={setName} />
        {error ? (
          <Text accessibilityLiveRegion="polite" style={s.error}>
            {error}
          </Text>
        ) : null}
        <View style={s.footerRow}>
          <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Save" onPress={save} disabled={pending} style={{ flex: 1 }} />
        </View>
      </SheetPanel>
    </Sheet>
  );
}

// --- Header title (name + date range; tap to rename) -------------------------

export function TripHeaderTitle({
  tripId,
  name,
  startDate,
  endDate,
  onRenamed,
}: {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  onRenamed: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rename"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.titleWrap, pressed && { transform: [{ scale: 0.99 }] }]}
      >
        <Text numberOfLines={1} style={s.titleName}>
          {name}
        </Text>
        <Text numberOfLines={1} style={s.titleDates}>
          {formatSubtitle(startDate, endDate)}
        </Text>
      </Pressable>
      <RenameSheet
        key={open ? tripId : 'closed'}
        visible={open}
        tripId={tripId}
        currentName={name}
        onClose={() => setOpen(false)}
        onRenamed={onRenamed}
      />
    </>
  );
}

// --- Header right (AI import entry) ------------------------------------------

export function TripHeaderRight({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="AI import"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [s.aiChip, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Sparkles size={18} color={colors.accent} strokeWidth={2} />
      </Pressable>
      <AiImportSheet
        key={open ? `ai-${tripId}` : 'ai-closed'}
        visible={open}
        tripId={tripId}
        onClose={() => setOpen(false)}
        // Web parity: imports show up immediately — tell the focused tab to refetch.
        onCreated={() => DeviceEventEmitter.emit('burgergo:dataChanged')}
      />
    </>
  );
}

const s = StyleSheet.create({
  titleWrap: { alignItems: 'center', maxWidth: 220 },
  titleName: {
    fontFamily: font.bold,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.38,
    color: colors.ink,
  },
  titleDates: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 14,
    color: colors.sub,
    fontVariant: ['tabular-nums'],
  },
  aiChip: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { marginTop: 12, ...type.caption, color: colors.danger },
  footerRow: { marginTop: 20, flexDirection: 'row', gap: 12 },
});
