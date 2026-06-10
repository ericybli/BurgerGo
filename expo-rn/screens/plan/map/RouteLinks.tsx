/**
 * "Open day route in Google Maps" deep links below the map (days bucket).
 * One visible day → the link rendered directly; several → a collapsible
 * "Open day routes in Google Maps" row (collapsed by default) expanding to one
 * link per day. Each link: hairline border, accent text, day-color dot.
 */
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../../lib/theme';
import type { RouteLink } from './mapData';

export function RouteLinks({ links }: { links: RouteLink[] }) {
  const [open, setOpen] = useState(false);
  if (links.length === 0) return null;

  if (links.length === 1) {
    return (
      <View style={s.host}>
        <LinkRow link={links[0]!} />
      </View>
    );
  }
  return (
    <View style={s.host}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [s.row, s.toggleRow, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.linkText}>Open day routes in Google Maps</Text>
        <Text style={s.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open
        ? links.map((l) => (
            <View key={l.date} style={{ marginTop: 8 }}>
              <LinkRow link={l} />
            </View>
          ))
        : null}
    </View>
  );
}

function LinkRow({ link }: { link: RouteLink }) {
  return (
    <Pressable
      onPress={() => {
        Linking.openURL(link.url).catch(() => {});
      }}
      accessibilityRole="link"
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.dot, { backgroundColor: link.color }]} />
      <Text style={s.linkText}>Open day route in Google Maps</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  host: { paddingHorizontal: 12, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleRow: { justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 999 },
  linkText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.accent },
  chevron: { fontSize: 12, color: colors.sub, fontFamily: font.medium },
});
