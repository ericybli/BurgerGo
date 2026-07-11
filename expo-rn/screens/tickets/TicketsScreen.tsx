/**
 * Tickets tab — reservations with optional date/time/location, a note, and
 * multi-file attachments (booking PDFs, QR-code images). Mirrors web
 * components/tickets/TicketsClient.tsx: cards sort by (date, time) ascending
 * with undated tickets last; attachments open inline via Linking; delete is a
 * two-tap confirm with no timeout (only moving to another card resets it).
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText } from 'lucide-react-native';
import { api, type Ticket } from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
import { gradientFor } from '../../lib/uiHash';
import { formatTicketWhen, ticketDayKey, ticketDayLabel } from './ticketFormat';
import { Button, Loading, Sheet } from '../../components/ui';
import { TicketSheet } from './TicketSheet';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; tickets: Ticket[] };

/** Web sort key: (date, time) ascending, NULLs last; stable sort keeps the server's createdAt tiebreak. */
const sortKey = (t: Ticket) => `${t.date ?? '9999-99-99'}T${t.time ?? '99:99'}`;

export function TicketsScreen() {
  const { tripId } = useTrip();
  const online = useOnline();
  // Transparent glass stack header (Task 5) — scroll content starts below it.
  const headerHeight = useHeaderHeight();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [sheet, setSheet] = useState<{ ticket: Ticket | null } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    api.tickets
      .list(tripId)
      .then(({ tickets }) => active && setState({ status: 'loaded', tickets }))
      .catch(() => active && setState((s) => (s.status === 'loaded' ? s : { status: 'error' })));
    return () => {
      active = false;
    };
  }, [tripId]);

  useFocusEffect(load);

  function handleDelete(id: string) {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      return;
    }
    setConfirmingDelete(null);
    void (async () => {
      try {
        await api.tickets.remove(tripId, id);
      } catch {
        /* transient — the reload below shows the truth */
      }
      load();
    })();
  }

  if (state.status === 'loading') return <Loading label="Loading your tickets…" />;
  if (state.status === 'error') {
    return (
      <MascotState
        headline="Couldn't load tickets"
        subtext="Check your connection and try again."
        action={
          // RN-only enhancement (web has no retry on this state) — kept per audit.
          <Button
            title="Retry"
            variant="secondary"
            onPress={() => {
              setState({ status: 'loading' });
              load();
            }}
          />
        }
      />
    );
  }

  const tickets = [...state.tickets].sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0,
  );

  // Bucket the already-sorted list into day groups, preserving first-seen order:
  // dated groups stay ascending, and the undated 'anytime' bucket lands last
  // (undated tickets sort last). One continuous index drives the entrance stagger.
  const groups: { key: string; items: Ticket[] }[] = [];
  for (const t of tickets) {
    const key = ticketDayKey(t.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(t);
    else groups.push({ key, items: [t] });
  }
  let runningIndex = 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingTop: headerHeight + 16 },
          tickets.length === 0 && { flexGrow: 1 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Tickets</Text>
          <AddTicketButton disabled={!online} onPress={() => setSheet({ ticket: null })} />
        </View>

        {tickets.length === 0 ? (
          <MascotState
            headline="No tickets yet"
            subtext="Keep reservations, booking PDFs, and QR codes in one place."
            action={
              // Web: large orange CTA (rounded-12, 14px semibold) = kit primary Button;
              // hidden offline, exactly like web's `actionLabel={online ? add : undefined}`.
              online ? (
                <Button title="Add ticket" onPress={() => setSheet({ ticket: null })} />
              ) : undefined
            }
          />
        ) : (
          groups.map((group, gi) => (
            <View key={group.key} style={styles.group}>
              <View style={[styles.dayHeader, gi === 0 ? styles.dayHeaderFirst : styles.dayHeaderRest]}>
                <View style={styles.dayHalo}>
                  <View style={styles.dayDot} />
                </View>
                <Text style={styles.dayLabel}>{ticketDayLabel(group.key)}</Text>
                <View style={styles.dayRule} />
                <Text style={styles.dayCount}>
                  {`${group.items.length} ticket${group.items.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <View style={styles.cards}>
                {group.items.map((tk) => (
                  <TicketCard
                    key={tk.id}
                    ticket={tk}
                    index={runningIndex++}
                    online={online}
                    confirming={confirmingDelete === tk.id}
                    onEdit={() => setSheet({ ticket: tk })}
                    onDelete={() => handleDelete(tk.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet visible={sheet !== null} onClose={() => setSheet(null)}>
        {sheet ? (
          // key-remount per open (web: `ticket:{id|new|closed}`) so the form always resets.
          <TicketSheet
            key={`ticket:${sheet.ticket?.id ?? 'new'}`}
            tripId={tripId}
            ticket={sheet.ticket}
            online={online}
            onClose={() => setSheet(null)}
            onSaved={() => {
              load();
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

// --- Empty / error state (web components/EmptyState.tsx: bundled mascot 112px
// @ 90% opacity above headline/subtext — always rendered for both states) -----

const MASCOT = require('../../assets/burgergo-logo.png');

function MascotState({
  headline,
  subtext,
  action,
}: {
  headline: string;
  subtext: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Image source={MASCOT} accessibilityLabel="Tickets" style={styles.mascot} resizeMode="contain" />
      <Text style={styles.emptyHead}>{headline}</Text>
      <Text style={styles.emptySub}>{subtext}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

// --- Header action (web: small orange "Add ticket") ---------------------------

function AddTicketButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.addBtn,
        pressed && !disabled && styles.addBtnPressed,
        disabled && styles.addBtnDisabled,
      ]}
    >
      <Text style={[styles.addBtnText, disabled && styles.addBtnTextDisabled]}>Add ticket</Text>
    </Pressable>
  );
}

// --- Ticket card --------------------------------------------------------------

function TicketCard({
  ticket,
  index,
  online,
  confirming,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  index: number;
  online: boolean;
  confirming: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const when = formatTicketWhen(ticket.date, ticket.time);
  const imageFiles = ticket.files.filter((f) => f.mime.startsWith('image/'));
  const pdfFiles = ticket.files.filter((f) => !f.mime.startsWith('image/'));
  const heroImage = imageFiles[0];
  // Up to three image-thumb chips; PDFs collapse into a single count chip.
  const thumbChips = imageFiles.slice(0, 3);

  return (
    <FadeUp delayIndex={Math.min(index, 6)}>
      <View style={styles.card}>
        {/* Hero band — deterministic gradient, overlaid by the first image if any. */}
        <View style={styles.band}>
          <LinearGradient
            colors={gradientFor(ticket.title)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {heroImage ? (
            <Image
              source={{ uri: api.tickets.fileUrl(heroImage.id) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.bandOverlay}>
            <View style={styles.bandChip}>
              <Text style={styles.bandChipGlyph}>🎟️</Text>
            </View>
            {when ? (
              <View style={styles.bandPill}>
                <Text style={styles.bandPillText}>{when}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Perforation — two edge notches with a dashed tear line between. */}
        <View style={styles.perf}>
          <View style={[styles.perfNotch, { left: -9 }]} />
          <View style={styles.perfDash} />
          <View style={[styles.perfNotch, { right: -9 }]} />
        </View>

        {/* Stub */}
        <View style={styles.stub}>
          <Text style={styles.cardTitle}>{ticket.title}</Text>
          {ticket.location ? (
            <Text style={styles.cardLocation} numberOfLines={1}>
              📍 {ticket.location}
            </Text>
          ) : null}
          {ticket.note ? (
            <Text style={styles.cardNote} numberOfLines={2}>
              {ticket.note}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.chipRow}>
              {thumbChips.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => void Linking.openURL(api.tickets.fileUrl(f.id))}
                  hitSlop={4}
                >
                  <Image
                    source={{ uri: api.tickets.fileUrl(f.id) }}
                    style={styles.thumbChip}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
              {pdfFiles.length > 0 ? (
                <Pressable
                  key={pdfFiles[0]!.id}
                  onPress={() => void Linking.openURL(api.tickets.fileUrl(pdfFiles[0]!.id))}
                  hitSlop={4}
                  style={({ pressed }) => [styles.pdfChip, pressed && { backgroundColor: colors.surface }]}
                >
                  <FileText size={14} strokeWidth={1.75} color={colors.accent} />
                  <Text style={styles.pdfChipText}>
                    {pdfFiles.length > 1 ? `PDF · ${pdfFiles.length}` : 'PDF'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable disabled={!online} onPress={onEdit} hitSlop={6}>
                <Text style={[styles.editText, !online && styles.disabledText]}>Edit</Text>
              </Pressable>
              <Pressable
                disabled={!online}
                onPress={onDelete}
                hitSlop={6}
                style={confirming ? styles.confirmPill : undefined}
              >
                <Text
                  style={[
                    confirming ? styles.confirmText : styles.deleteText,
                    !online && styles.disabledText,
                  ]}
                >
                  {confirming ? 'Tap again to delete' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </FadeUp>
  );
}

// --- Staggered entrance (web: animate-fade-up, delay min(i,6)×40ms) ----------

function FadeUp({ delayIndex, children }: { delayIndex: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: delayIndex * 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, delayIndex]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Bottom padding clears the floating glass tab bar (content scrolls under it).
  list: { padding: 16, paddingBottom: 150, gap: 12 },

  // Day-grouped timeline: a header row per day, then that day's cards.
  group: {},
  cards: { gap: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  dayHeaderFirst: { marginTop: 4 },
  dayHeaderRest: { marginTop: 20 },
  dayHalo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accent },
  dayLabel: { ...type.micro, color: colors.sub, textTransform: 'uppercase' },
  dayRule: { flex: 1, height: 1, backgroundColor: colors.line },
  dayCount: { ...type.caption, color: colors.faint },

  // Web EmptyState recipe: px-6 py-16 centered; mascot mb-6 h-28 w-28 opacity-90;
  // subtext mt-2 max-w-xs; CTA mt-6.
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
    backgroundColor: colors.bg,
  },
  mascot: { width: 112, height: 112, opacity: 0.9, marginBottom: 24 },
  emptyHead: { ...type.heading, color: colors.ink, textAlign: 'center' },
  emptySub: { ...type.body, color: colors.sub, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  emptyAction: { marginTop: 24 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: font.bold, fontSize: 21, letterSpacing: -0.42, color: colors.ink },

  addBtn: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnPressed: { backgroundColor: colors.orangePress },
  addBtnDisabled: { backgroundColor: colors.surface },
  addBtnText: { ...type.label, color: colors.white },
  addBtnTextDisabled: { color: colors.faint },

  card: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 0,
    shadowColor: '#14181A',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  // Hero band — gradient base, optional photo overlay, glass chip + when pill.
  band: { height: 92, position: 'relative' },
  bandOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bandChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  bandChipGlyph: { fontSize: 20, lineHeight: 24 },
  bandPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bandPillText: {
    fontFamily: font.bold,
    fontSize: 12.5,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },

  // Perforation between band and stub.
  perf: { height: 0, position: 'relative' },
  perfNotch: {
    position: 'absolute',
    top: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  perfDash: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },

  stub: { backgroundColor: colors.white, paddingVertical: 14, paddingHorizontal: 16 },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.17,
    color: colors.ink,
  },
  cardLocation: { fontFamily: font.medium, fontSize: 13.5, lineHeight: 18, color: colors.sub, marginTop: 4 },
  cardNote: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.sub, marginTop: 6 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  thumbChip: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pdfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    paddingHorizontal: 9,
  },
  pdfChipText: { fontFamily: font.semibold, fontSize: 12, color: colors.ink },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editText: { ...type.label, color: colors.accent },
  deleteText: { ...type.label, color: colors.danger },
  confirmPill: {
    backgroundColor: colors.danger,
    borderRadius: radius.control,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirmText: { ...type.label, color: colors.white },
  disabledText: { color: colors.faint },
});
