import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Field, SheetPanel } from '../../components/ui';

/**
 * Name-input sheet for creating / renaming a saved list (web ListNameSheet).
 * Stateless about which mode it is — the host passes title + submit label and
 * keys the component so the input resets on each open. Render inside <Sheet>.
 */
export function ListNameSheet({
  title,
  submitLabel,
  initialName = '',
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  return (
    <SheetPanel title={title}>
      <Field
        placeholder="List name"
        accessibilityLabel="List name"
        value={name}
        onChangeText={setName}
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <View style={styles.actions}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title={submitLabel} onPress={submit} disabled={name.trim().length === 0} style={{ flex: 1 }} />
      </View>
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
});
