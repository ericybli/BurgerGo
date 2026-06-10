/**
 * Create/rename a Photography list, ported from
 * components/journal/PhotoListSheet.tsx. Single "List name" field (autofocus,
 * submit on return); required → "Name this list."; primary button "Create"
 * (create) / "Save" (rename) + Cancel. Key-remounted on every open.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { colors, type } from '../../lib/theme';
import { Button } from '../../components/ui';
import { ErrorBanner, FormField } from './formBits';
import { STR } from './strings';

export function PhotoListSheet({
  tripId,
  list,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  /** Present → rename mode; null → create mode. */
  list: { id: string; name: string } | null;
  online: boolean;
  onClose: () => void;
  /** Reloads the owner; the sheet closes itself after save. */
  onSaved: () => void;
}) {
  const isRename = list !== null;
  const [name, setName] = useState(list?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(STR.listNameRequired);
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (isRename && list) await api.photoLists.rename(tripId, list.id, trimmed);
      else await api.photoLists.add(tripId, trimmed);
      onSaved();
      onClose();
    } catch {
      setPending(false);
      setError(STR.mutationFailed);
    }
  }

  return (
    <View>
      {error ? <ErrorBanner text={error} style={pl.bannerGap} /> : null}
      {!online ? <Text style={pl.offlineHint}>{STR.offlineHint}</Text> : null}

      <FormField
        label={STR.listNameLabel}
        value={name}
        onChangeText={setName}
        editable={online && !pending}
        autoFocus
        placeholder={STR.listNamePlaceholder}
        returnKeyType="done"
        onSubmitEditing={save}
      />

      <View style={pl.btnRow}>
        <Button
          title={isRename ? STR.save : STR.createList}
          onPress={save}
          disabled={!online}
          busy={pending}
          style={{ flex: 1 }}
        />
        <Button title={STR.cancel} variant="secondary" onPress={onClose} style={{ width: 90 }} />
      </View>
    </View>
  );
}

const pl = StyleSheet.create({
  bannerGap: { marginTop: 8 },
  offlineHint: { marginTop: 8, ...type.caption, color: colors.sub },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
});
