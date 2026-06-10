/**
 * Lightweight markdown renderer for journal entry bodies (no new deps).
 * Covers the subset the web's GFM pipeline styles in Markdown.tsx: headings
 * (h1/h2+), paragraphs (single newlines collapse to spaces, like GFM soft
 * breaks), bullet/ordered lists, blockquotes, hr, and inline **bold**,
 * *italic*, `code`, [links](https://…). Raw HTML is never interpreted —
 * everything else renders as plain text (matches rehype-sanitize dropping it).
 * Links open externally via Linking (http/https only), accent + underline.
 */
import { useMemo, type ReactNode } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../lib/theme';
import { isHttpUrl } from '../../lib/journalView';

type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string };

const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(src)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    if (m[1] !== undefined && m[2] !== undefined) out.push({ kind: 'link', text: m[1], url: m[2] });
    else if (m[3] !== undefined) out.push({ kind: 'bold', text: m[3] });
    else if (m[4] !== undefined) out.push({ kind: 'italic', text: m[4] });
    else if (m[5] !== undefined) out.push({ kind: 'code', text: m[5] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

type Block =
  | { kind: 'heading'; level: 1 | 2; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; items: { marker: string; text: string }[] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { marker: string; text: string }[] | null = null;
  let quote: string[] | null = null;

  const flushPara = () => {
    if (para.length > 0) blocks.push({ kind: 'para', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: 'list', items: list });
    list = null;
  };
  const flushQuote = () => {
    if (quote) blocks.push({ kind: 'quote', text: quote.join(' ') });
    quote = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') {
      flushAll();
      continue;
    }
    const h = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushAll();
      blocks.push({ kind: 'heading', level: h[1]!.length === 1 ? 1 : 2, text: h[2]! });
      continue;
    }
    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll();
      blocks.push({ kind: 'hr' });
      continue;
    }
    const ul = /^\s{0,3}[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      flushQuote();
      (list ??= []).push({ marker: '•', text: ul[1]! });
      continue;
    }
    const ol = /^\s{0,3}(\d+)[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      flushQuote();
      (list ??= []).push({ marker: `${ol[1]}.`, text: ol[2]! });
      continue;
    }
    const q = /^\s{0,3}>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushList();
      (quote ??= []).push(q[1]!);
      continue;
    }
    flushList();
    flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return blocks;
}

function renderInline(src: string): ReactNode[] {
  return parseInline(src).map((t, i) => {
    switch (t.kind) {
      case 'text':
        return <Text key={i}>{t.text}</Text>;
      case 'bold':
        return (
          <Text key={i} style={md.bold}>
            {t.text}
          </Text>
        );
      case 'italic':
        return (
          <Text key={i} style={md.italic}>
            {t.text}
          </Text>
        );
      case 'code':
        return (
          <Text key={i} style={md.code}>
            {t.text}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={i}
            style={md.link}
            onPress={() => {
              if (isHttpUrl(t.url)) void Linking.openURL(t.url);
            }}
          >
            {t.text}
          </Text>
        );
    }
  });
}

/** Render a markdown source; returns nothing for blank input. */
export function MarkdownText({ source }: { source: string }) {
  const blocks = useMemo(() => parseBlocks(source), [source]);
  if (blocks.length === 0) return null;
  return (
    <View>
      {blocks.map((b, i) => {
        const first = i === 0 ? md.first : undefined;
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} style={[b.level === 1 ? md.h1 : md.h2, first]}>
                {renderInline(b.text)}
              </Text>
            );
          case 'para':
            return (
              <Text key={i} style={[md.p, first]}>
                {renderInline(b.text)}
              </Text>
            );
          case 'list':
            return (
              <View key={i} style={[md.list, first]}>
                {b.items.map((item, j) => (
                  <View key={j} style={md.liRow}>
                    <Text style={md.liMarker}>{item.marker}</Text>
                    <Text style={md.liText}>{renderInline(item.text)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View key={i} style={[md.quote, first]}>
                <Text style={md.quoteText}>{renderInline(b.text)}</Text>
              </View>
            );
          case 'hr':
            return <View key={i} style={md.hr} />;
        }
      })}
    </View>
  );
}

const md = StyleSheet.create({
  first: { marginTop: 0 },
  p: { marginTop: 12, fontSize: 13.5, lineHeight: 21, color: colors.ink, fontFamily: font.regular },
  h1: {
    marginTop: 20,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.19,
    color: colors.ink,
    fontFamily: font.bold,
  },
  h2: {
    marginTop: 20,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.16,
    color: colors.ink,
    fontFamily: font.bold,
  },
  list: { marginTop: 12 },
  liRow: { flexDirection: 'row', marginTop: 4, marginLeft: 8 },
  liMarker: {
    width: 18,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.ink,
    fontFamily: font.regular,
    fontVariant: ['tabular-nums'],
  },
  liText: { flex: 1, fontSize: 13.5, lineHeight: 21, color: colors.ink, fontFamily: font.regular },
  quote: {
    marginTop: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
    paddingLeft: 12,
  },
  quoteText: { fontSize: 13.5, lineHeight: 21, color: colors.sub, fontFamily: font.regular },
  hr: { marginVertical: 16, height: 1, backgroundColor: colors.line },
  bold: { fontFamily: font.semibold },
  // Instrument Sans ships no italic face in the app; iOS won't synthesize it,
  // so italic may render upright on native (works on web).
  italic: { fontStyle: 'italic' },
  code: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12.5,
  },
  link: { color: colors.accent, textDecorationLine: 'underline' },
});
