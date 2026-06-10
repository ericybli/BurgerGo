import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, font, type } from '../../lib/theme';
import { Button, SheetPanel } from '../../components/ui';

export type SavedListItem = { id: string; name: string };

/**
 * Pick which list a saved place goes into (web ListPickerSheet): an existing
 * list, "Remove from list" (only when currently in one), or "+ New list…"
 * (hands off to the name sheet, which creates + moves). Render inside <Sheet>.
 */
export function ListPickerSheet({
  lists,
  currentListId,
  onPick,
  onNewList,
  onClose,
}: {
  lists: SavedListItem[];
  currentListId: string | null;
  onPick: (listId: string | null) => void;
  onNewList: () => void;
  onClose: () => void;
}) {
  return (
    <SheetPanel title="Move to which list?">
      <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
        {lists.map((l) => {
          const current = l.id === currentListId;
          return (
            <Pressable
              key={l.id}
              accessibilityState={{ selected: current }}
              onPress={() => {
                onPick(l.id);
                onClose();
              }}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.rowText, current && styles.rowTextCurrent]}>
                {l.name}
                {current ? ' ✓' : ''}
              </Text>
            </Pressable>
          );
        })}
        {currentListId !== null ? (
          <Pressable
            onPress={() => {
              onPick(null);
              onClose();
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
          >
            <Text style={styles.rowText}>Remove from list</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onNewList}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.rowTextNew}>+ New list…</Text>
        </Pressable>
      </ScrollView>
      <Button title="Cancel" variant="secondary" onPress={onClose} style={{ marginTop: 12 }} />
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  rowText: { ...type.body, color: colors.ink },
  rowTextCurrent: { fontFamily: font.semibold, color: colors.accent },
  rowTextNew: { ...type.body, fontFamily: font.semibold, color: colors.orange },
});
