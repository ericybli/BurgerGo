/**
 * Journal section (Atlas Light), ported from components/journal/
 * JournalClient.tsx. One fetch on mount (`GET /api/trips/{id}/journal`),
 * full refetch after every mutation. Three tabs — Entries / Reading list /
 * Photography — with per-tab create buttons (orange; entries hides its button
 * when the list is empty because the empty state owns the action). The entry
 * reader is a full-view replacement bound to the freshest loaded copy of its
 * entry id; all add/edit sheets are key-remounted on every open.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  api,
  photoUrl,
  type JournalEntry,
  type PhotoList,
  type SavedLink,
} from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
import { entrySnippet, linkDomain, linkHeading } from '../../lib/journalView';
import {
  EmptyState,
  ErrorState,
  Loading,
  SegmentedControl,
  Sheet,
  SheetPanel,
} from '../../components/ui';
import { SmallPrimaryButton } from './formBits';
import { EntryReader } from './EntryReader';
import { EntrySheet } from './EntrySheet';
import { LinkSheet } from './LinkSheet';
import { PhotographyTab } from './PhotographyTab';
import { STR } from './strings';

const LOGO = require('../../assets/burgergo-logo.png');

type Tab = 'entries' | 'links' | 'photography';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; entries: JournalEntry[]; links: SavedLink[]; photoLists: PhotoList[] };

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'entries', label: STR.entries },
  { value: 'links', label: STR.readingList },
  { value: 'photography', label: STR.photography },
];

export function JournalScreen() {
  const { tripId } = useTrip();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('entries');
  const [state, setState] = useState<State>({ status: 'loading' });

  // Reader — keeps the opened entry; re-bound to the freshest copy by id.
  const [reading, setReading] = useState<JournalEntry | null>(null);
  // Entry add/edit sheet. `entry === null` in the slot means add mode.
  const [entrySheet, setEntrySheet] = useState<{ entry: JournalEntry | null } | null>(null);
  // Link add/edit sheet.
  const [linkSheet, setLinkSheet] = useState<{ link: SavedLink | null } | null>(null);

  const load = useCallback(() => {
    let active = true;
    api.journal
      .get(tripId)
      .then(
        (r) =>
          active &&
          setState({
            status: 'loaded',
            entries: r.entries,
            links: r.links,
            photoLists: r.photoLists ?? [],
          }),
      )
      .catch(() => active && setState((s) => (s.status === 'loaded' ? s : { status: 'error' })));
    return () => {
      active = false;
    };
  }, [tripId]);

  useEffect(() => load(), [load]);

  if (state.status === 'loading') return <Loading label={STR.loading} />;
  if (state.status === 'error') {
    return (
      <ErrorState
        headline={STR.errorHeadline}
        subtext={STR.errorSubtext}
        onRetry={() => {
          setState({ status: 'loading' });
          load();
        }}
      />
    );
  }

  const { entries, links, photoLists } = state;

  // The reader is a full-view replacement (like opening a detail page).
  // Bind to the latest loaded copy so photos added in the edit sheet appear.
  if (reading) {
    const fresh = entries.find((e) => e.id === reading.id) ?? reading;
    return (
      <EntryReader
        entry={fresh}
        online={online}
        onBack={() => setReading(null)}
        onEdit={() => {
          // Web parity: the reader unmounts first, then the sheet opens.
          setReading(null);
          setEntrySheet({ entry: fresh });
        }}
        onDelete={async () => {
          await api.journal.deleteEntry(tripId, fresh.id);
          setReading(null);
          load();
        }}
      />
    );
  }

  // Keep the edit sheet's entry bound to the freshest loaded copy too, so
  // photo uploads (which refetch while the sheet stays open) show up.
  const sheetEntry =
    entrySheet?.entry != null
      ? entries.find((e) => e.id === entrySheet.entry!.id) ?? entrySheet.entry
      : null;

  return (
    <View style={js.root}>
      <View style={js.tabsWrap}>
        <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </View>

      <ScrollView contentContainerStyle={js.list}>
        {tab === 'photography' ? (
          <PhotographyTab tripId={tripId} lists={photoLists} online={online} onChanged={load} />
        ) : tab === 'links' ? (
          <>
            {/* The links tab always shows its add button, even when empty. */}
            <View style={js.actionRow}>
              <SmallPrimaryButton
                title={STR.addLink}
                disabled={!online}
                onPress={() => setLinkSheet({ link: null })}
              />
            </View>
            {links.length === 0 ? (
              <EmptyState headline={STR.linksEmptyHeadline} subtext={STR.linksEmptySubtext} />
            ) : (
              links.map((l) => (
                <LinkRow
                  key={l.id}
                  link={l}
                  online={online}
                  onEdit={() => setLinkSheet({ link: l })}
                  onDeleted={load}
                  tripId={tripId}
                />
              ))
            )}
          </>
        ) : entries.length === 0 ? (
          // Empty entries: the empty state owns the action (no header button).
          <EmptyState
            headline={STR.emptyHeadline}
            subtext={STR.emptySubtext}
            action={
              online ? (
                <SmallPrimaryButton
                  title={STR.newEntry}
                  onPress={() => setEntrySheet({ entry: null })}
                />
              ) : undefined
            }
          />
        ) : (
          <>
            <View style={js.actionRow}>
              <SmallPrimaryButton
                title={STR.newEntry}
                disabled={!online}
                onPress={() => setEntrySheet({ entry: null })}
              />
            </View>
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} onPress={() => setReading(e)} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Entry add/edit sheet (key-remounted per target; photos re-bind fresh). */}
      <Sheet visible={entrySheet !== null} onClose={() => setEntrySheet(null)}>
        {entrySheet ? (
          <SheetPanel
            title={sheetEntry ? STR.editEntry : STR.newEntry}
            style={{ maxHeight: '85%' }}
          >
            <EntrySheet
              key={sheetEntry?.id ?? 'new-entry'}
              tripId={tripId}
              entry={sheetEntry}
              online={online}
              onClose={() => setEntrySheet(null)}
              onSaved={load}
            />
          </SheetPanel>
        ) : null}
      </Sheet>

      {/* Link add/edit sheet. */}
      <Sheet visible={linkSheet !== null} onClose={() => setLinkSheet(null)}>
        {linkSheet ? (
          <SheetPanel
            title={linkSheet.link ? STR.editLink : STR.addLink}
            style={{ maxHeight: '85%' }}
          >
            <LinkSheet
              key={linkSheet.link?.id ?? 'new-link'}
              tripId={tripId}
              link={linkSheet.link}
              online={online}
              onClose={() => setLinkSheet(null)}
              onSaved={load}
            />
          </SheetPanel>
        ) : null}
      </Sheet>
    </View>
  );
}

// --- Entries feed card (whole card tappable → reader) ------------------------

function EntryCard({ entry, onPress }: { entry: JournalEntry; onPress: () => void }) {
  const snippet = entry.body.trim() !== '' ? entrySnippet(entry.body) : '';
  const thumbs = entry.photos.slice(0, 4);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [js.entryCard, pressed && { backgroundColor: colors.surface }]}
    >
      <Text style={js.entryTitle}>{entry.title}</Text>
      {entry.entryDate ? <Text style={js.entryDate}>{entry.entryDate}</Text> : null}
      {snippet ? (
        <Text style={js.entrySnippet} numberOfLines={2}>
          {snippet}
        </Text>
      ) : null}
      {thumbs.length > 0 ? (
        <View style={js.thumbRow}>
          {thumbs.map((p) => (
            <Image
              key={p.id}
              source={{ uri: photoUrl.personal(p.id, 'thumb') }}
              style={js.thumb}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

// --- Reading-list row ---------------------------------------------------------

function LinkRow({
  link,
  online,
  onEdit,
  onDeleted,
  tripId,
}: {
  link: SavedLink;
  online: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  tripId: string;
}) {
  const [busy, setBusy] = useState(false);
  const domain = linkDomain(link.url);
  const heading = linkHeading(link.title, link.url);

  async function open() {
    try {
      await Linking.openURL(link.url);
    } catch {
      // unopenable URL — ignore
    }
  }

  // Link delete is single-tap immediate (web parity — no confirm).
  async function remove() {
    setBusy(true);
    try {
      await api.journal.deleteLink(tripId, link.id);
      onDeleted();
    } catch {
      setBusy(false);
    }
  }

  return (
    <View style={js.linkCard}>
      <Pressable
        style={({ pressed }) => [js.linkMain, pressed && { opacity: 0.7 }]}
        onPress={open}
        accessibilityLabel={heading}
      >
        {link.thumbnail != null ? (
          <Image source={{ uri: photoUrl.linkThumb(link.id) }} style={js.linkThumb} />
        ) : (
          <View style={js.linkThumbFallback}>
            <Image source={LOGO} style={js.linkLogo} resizeMode="contain" />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={js.linkHeading} numberOfLines={1}>
            {heading}
          </Text>
          <Text style={js.linkDomain} numberOfLines={1}>
            {domain}
          </Text>
          {link.note ? (
            <Text style={js.linkDomain} numberOfLines={1}>
              {link.note}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={js.linkActions}>
        <Pressable
          hitSlop={6}
          disabled={!online || busy}
          onPress={onEdit}
          // Web parity: active:opacity-70 on the link-row actions.
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <Text style={[js.linkEdit, (!online || busy) && { opacity: 0.4 }]}>{STR.edit}</Text>
        </Pressable>
        <Pressable
          hitSlop={6}
          disabled={!online || busy}
          onPress={remove}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <Text style={[js.linkDelete, (!online || busy) && { opacity: 0.4 }]}>
            {STR.deleteLink}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const js = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabsWrap: { paddingHorizontal: 16, paddingTop: 10 },
  // Bottom padding clears the floating glass tab bar (content scrolls under it).
  list: { padding: 16, paddingBottom: 150, gap: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },

  // Entry card — white bg + hairline border, radius 14 (no shadows).
  entryCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  entryTitle: {
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.155,
    fontFamily: font.bold,
    color: colors.ink,
  },
  entryDate: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: font.medium,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
  entrySnippet: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.regular,
    color: colors.sub,
  },
  thumbRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },

  // Link row.
  linkCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  linkThumbFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLogo: { width: 36, height: 36 },
  linkHeading: { fontSize: 13.5, lineHeight: 18, fontFamily: font.semibold, color: colors.ink },
  linkDomain: {
    marginTop: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: font.regular,
    color: colors.faint,
  },
  linkActions: { justifyContent: 'center', gap: 6 },
  linkEdit: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
  linkDelete: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
});
