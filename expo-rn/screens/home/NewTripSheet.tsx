/**
 * "New trip" bottom sheet (web components/NewTripSheet.tsx). Name + start/end
 * dates; client validation mirrors the web copy; success refetches the Home
 * list and closes. Mount with a fresh `key` per open so the fields reset.
 * Dates are plain YYYY-MM-DD text inputs (no native datepicker — works on web).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { colors, type } from '../../lib/theme';
import { Button, Field, OfflineHint, Sheet, SheetPanel } from '../../components/ui';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function NewTripSheet({
  visible,
  online,
  onClose,
  onCreated,
}: {
  visible: boolean;
  online: boolean;
  onClose: () => void;
  /** Fired after a successful create (before close) so the owner can refresh its list. */
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    if (name.trim().length === 0) {
      setError('Please enter a trip name.');
      return;
    }
    // RN uses free-text date fields, so format gets a lenient gate the web
    // delegates to <input type=date>.
    if (!DATE_RE.test(startDate)) {
      setError('Start date must be YYYY-MM-DD.');
      return;
    }
    if (!DATE_RE.test(endDate)) {
      setError('End date must be YYYY-MM-DD.');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }
    setPending(true);
    try {
      await api.trips.create({ name: name.trim(), startDate, endDate });
      onCreated();
      onClose();
    } catch {
      setPending(false);
      setError("Couldn't save — please try again.");
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetPanel title="New trip" style={s.panel}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Field
            label="Trip name"
            value={name}
            onChangeText={setName}
            placeholder="Tokyo adventure"
            editable={!pending}
          />
          <Field
            label="Start date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!pending}
          />
          <Field
            label="End date"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!pending}
          />
          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}
          {!online ? <OfflineHint /> : null}
          <View style={s.row}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Create trip" onPress={submit} busy={pending} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </SheetPanel>
    </Sheet>
  );
}

const s = StyleSheet.create({
  panel: { maxHeight: '85%' },
  error: { marginTop: 12, ...type.caption, fontFamily: type.caption.fontFamily, color: colors.danger },
  row: { flexDirection: 'row', gap: 12, marginTop: 24 },
});
