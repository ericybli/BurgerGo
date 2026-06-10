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
import { FileText, Image as ImageIcon } from 'lucide-react-native';
import { api, type Ticket } from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.list, tickets.length === 0 && { flexGrow: 1 }]}
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
          tickets.map((tk, i) => (
            <TicketCard
              key={tk.id}
              ticket={tk}
              index={i}
              online={online}
              confirming={confirmingDelete === tk.id}
              onEdit={() => setSheet({ ticket: tk })}
              onDelete={() => handleDelete(tk.id)}
            />
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
  const when = [ticket.date, ticket.time].filter(Boolean).join(' · ');
  return (
    <FadeUp delayIndex={Math.min(index, 6)}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{ticket.title}</Text>
        {when ? <Text style={styles.cardWhen}>{when}</Text> : null}
        {ticket.location ? <Text style={styles.cardLocation}>{ticket.location}</Text> : null}
        {ticket.note ? <Text style={styles.cardNote}>{ticket.note}</Text> : null}

        {ticket.files.length > 0 ? (
          <View style={styles.fileList}>
            {ticket.files.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => void Linking.openURL(api.tickets.fileUrl(f.id))}
                style={({ pressed }) => [styles.fileRow, pressed && { backgroundColor: colors.surface }]}
              >
                {f.mime === 'application/pdf' ? (
                  <FileText size={15} strokeWidth={1.75} color={colors.accent} />
                ) : (
                  <ImageIcon size={15} strokeWidth={1.75} color={colors.accent} />
                )}
                <Text style={styles.fileName} numberOfLines={1}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
  list: { padding: 16, paddingBottom: 40, gap: 12 },

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
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.155,
    color: colors.ink,
  },
  cardWhen: { ...type.caption, color: colors.faint, fontVariant: ['tabular-nums'], marginTop: 2 },
  cardLocation: { ...type.caption, color: colors.sub, marginTop: 4 },
  cardNote: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.sub, marginTop: 6 },

  fileList: { marginTop: 10, gap: 6 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fileName: { ...type.caption, fontFamily: font.semibold, color: colors.ink, flex: 1 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
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
