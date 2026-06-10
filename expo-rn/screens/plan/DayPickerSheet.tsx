import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Day } from '../../lib/days';
import { colors, font, type } from '../../lib/theme';
import { Button, SheetPanel } from '../../components/ui';

/**
 * Bottom-sheet day chooser (web DayPickerSheet): rows "Day {n} · {Mon}". Used
 * to move/copy a place to another day and to promote a Saved place onto one;
 * picking fires `onPick(date)` then closes. Render inside a <Sheet>.
 */
export function DayPickerSheet({
  title,
  days,
  onPick,
  onClose,
}: {
  title: string;
  days: Day[];
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetPanel title={title}>
      <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
        {days.map((d) => (
          <Pressable
            key={d.date}
            onPress={() => {
              onPick(d.date);
              onClose();
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
          >
            <Text style={styles.rowText}>{`Day ${d.dayNumber} · ${d.weekday}`}</Text>
          </Pressable>
        ))}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowText: { ...type.body, fontFamily: font.medium, color: colors.ink },
});
