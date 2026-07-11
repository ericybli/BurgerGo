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
import { Button, DateField, Field, OfflineHint, Sheet, SheetPanel } from '../../components/ui';

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
    if (!startDate) {
      setError('Please choose a start date.');
      return;
    }
    if (!endDate) {
      setError('Please choose an end date.');
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
          <DateField
            label="Start date"
            value={startDate}
            onChange={setStartDate}
            clearable={false}
            disabled={pending}
          />
          <DateField
            label="End date"
            value={endDate}
            onChange={setEndDate}
            clearable={false}
            minDate={startDate || undefined}
            disabled={pending}
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
