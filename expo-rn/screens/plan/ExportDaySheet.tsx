import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../lib/theme';
import { Button, SheetPanel } from '../../components/ui';
import { copyText } from './planShared';

/**
 * "Copy day as text" sheet (web ExportDaySheet): the day's plain-text itinerary
 * in a readonly, selectable box + Cancel / Copy (orange; flips to "Copied ✓"
 * for 2s). The text stays selectable for manual copy when no clipboard exists.
 */
export function ExportDaySheet({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SheetPanel title="Day itinerary">
      <ScrollView style={styles.textBox}>
        <Text selectable style={styles.text}>
          {text}
        </Text>
      </ScrollView>
      <View style={styles.actions}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title={copied ? 'Copied ✓' : 'Copy'} onPress={() => void copy()} style={{ flex: 1 }} />
      </View>
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  textBox: {
    marginTop: 6,
    height: 256,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
