import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { Place } from '../../lib/api';
import { colors, font } from '../../lib/theme';
import { thumbForPlace } from '../../lib/legView';
import { categoryLabel, useTwoTapConfirm } from './planShared';
import { PhotoPlaceholder } from './PhotoPlaceholder';

export type PlaceDensity = 'rows' | 'cards';

type PlaceCardProps = {
  place: Place;
  pinNumber: number;
  pinColor: string;
  density: PlaceDensity;
  /** Offline or mutation in flight → management actions disabled. */
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** Tap on the body → edit sheet. */
  onTap: () => void;
  /** View → read card (works offline). */
  onView: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToSaved: () => void;
  onMoveToDay: () => void;
  onCopyToDay: () => void;
  onDelete: () => void;
};

/** Outline action pill (accent = info actions, danger = delete). */
function Pill({
  label,
  onPress,
  disabled,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'danger' | 'neutral';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        tone === 'danger' && styles.pillDanger,
        tone === 'neutral' && styles.pillNeutral,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === 'danger' && { color: colors.danger },
          tone === 'neutral' && { color: colors.sub },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One itinerary stop, in either density (web PlaceCard):
 * - rows: 54px thumb, hairline separator, chevrons in a right column;
 * - cards: rounded hairline card with a 140px photo and pill actions.
 */
export function PlaceCard({
  place,
  pinNumber,
  pinColor,
  density,
  disabled,
  isFirst,
  isLast,
  onTap,
  onView,
  onMoveUp,
  onMoveDown,
  onMoveToSaved,
  onMoveToDay,
  onCopyToDay,
  onDelete,
}: PlaceCardProps) {
  const [managing, setManaging] = useState(false);
  const del = useTwoTapConfirm(onDelete);
  // Large cards span the screen (~1100px at 3x): serve the 1600px 'full' tier;
  // compact rows (54pt) keep the 800px 'card'.
  const thumb = thumbForPlace(place, density === 'cards' ? 'full' : 'card');
  const hasMeta = place.scheduledTime != null || place.durationMin != null;

  const pin = (
    <View style={[styles.pin, { backgroundColor: pinColor }]}>
      <Text style={styles.pinText}>{pinNumber}</Text>
    </View>
  );

  const meta = hasMeta ? (
    <View style={styles.metaRow}>
      {place.scheduledTime ? <Text style={styles.metaText}>{place.scheduledTime}</Text> : null}
      {place.durationMin != null ? <Text style={styles.metaText}>{place.durationMin} min</Text> : null}
    </View>
  ) : null;

  const managePills = (
    <View style={styles.manageRow}>
      <Pill label="Move to Saved" onPress={onMoveToSaved} disabled={disabled} />
      <Pill label="Move" onPress={onMoveToDay} disabled={disabled} />
      <Pill label="Copy" onPress={onCopyToDay} disabled={disabled} />
      <Pill label={del.armed ? 'Sure? Delete' : 'Delete'} onPress={del.fire} disabled={disabled} tone="danger" />
    </View>
  );

  const chevrons = (horizontal: boolean) => (
    <View style={[styles.chevronCol, horizontal && styles.chevronRow]}>
      <Pressable
        hitSlop={6}
        accessibilityLabel="Move up"
        disabled={disabled || isFirst}
        onPress={onMoveUp}
        style={[styles.chevronBtn, (disabled || isFirst) && { opacity: 0.3 }]}
      >
        <ChevronUp size={14} color={colors.faint} />
      </Pressable>
      <Pressable
        hitSlop={6}
        accessibilityLabel="Move down"
        disabled={disabled || isLast}
        onPress={onMoveDown}
        style={[styles.chevronBtn, (disabled || isLast) && { opacity: 0.3 }]}
      >
        <ChevronDown size={14} color={colors.faint} />
      </Pressable>
    </View>
  );

  if (density === 'rows') {
    return (
      <View style={[styles.rowWrap, !isLast && styles.rowSeparator]}>
        <View style={styles.rowPinCol}>{pin}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable onPress={onTap} style={styles.rowBody}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.rowThumb} resizeMode="cover" />
            ) : (
              <PhotoPlaceholder category={place.category} height={54} style={styles.rowThumb} glyphSize={22} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {categoryLabel(place.category)}
                {place.address ? ` · ${place.address}` : ''}
              </Text>
              {meta}
            </View>
          </Pressable>
          <View style={styles.rowActions}>
            <Pressable onPress={onView} hitSlop={4}>
              <Text style={styles.viewText}>View</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setManaging((v) => !v);
                del.disarm();
              }}
              hitSlop={4}
              accessibilityState={{ expanded: managing }}
            >
              <Text style={styles.manageText}>Manage</Text>
            </Pressable>
          </View>
          {managing ? <View style={styles.rowManageWrap}>{managePills}</View> : null}
        </View>
        {chevrons(false)}
      </View>
    );
  }

  return (
    <View style={styles.cardWrap}>
      <View style={styles.cardPinCol}>{pin}</View>
      <View style={styles.card}>
        <Pressable onPress={onTap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.cardPhoto} resizeMode="cover" />
          ) : (
            <PhotoPlaceholder category={place.category} height={140} />
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={1}>
              {place.name}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {categoryLabel(place.category)}
              {place.address ? ` · ${place.address}` : ''}
            </Text>
            {meta}
          </View>
        </Pressable>
        <View style={styles.cardActions}>
          <Pill label="View" onPress={onView} />
          <Pill
            label="Manage"
            tone="neutral"
            onPress={() => {
              setManaging((v) => !v);
              del.disarm();
            }}
          />
          <View style={styles.cardChevrons}>{chevrons(true)}</View>
        </View>
        {managing ? <View style={styles.cardManageWrap}>{managePills}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pinText: { color: colors.white, fontFamily: font.bold, fontSize: 11.5, fontVariant: ['tabular-nums'] },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  metaText: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, fontVariant: ['tabular-nums'] },

  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.bg,
  },
  pillDanger: { borderColor: colors.danger },
  pillNeutral: { borderColor: colors.line },
  pillText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.accent },

  chevronCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  chevronRow: { flexDirection: 'row', gap: 4 },
  chevronBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // rows density
  rowWrap: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  rowSeparator: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowPinCol: { width: 24, alignItems: 'center', paddingTop: 16 },
  rowBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowThumb: { width: 54, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface },
  rowName: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  rowSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.sub, marginTop: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 5, paddingLeft: 64 },
  rowManageWrap: { marginTop: 8, paddingLeft: 64 },
  viewText: { fontFamily: font.semibold, fontSize: 12, color: colors.accent, paddingVertical: 2 },
  manageText: { fontFamily: font.semibold, fontSize: 12, color: colors.sub, paddingVertical: 2 },

  // cards density
  cardWrap: { flexDirection: 'row', gap: 10 },
  cardPinCol: { width: 24, alignItems: 'center', paddingTop: 4 },
  card: {
    flex: 1,
    minWidth: 0,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  cardPhoto: { width: '100%', height: 140, backgroundColor: colors.surface },
  cardBody: { paddingHorizontal: 12, paddingTop: 10 },
  cardName: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, letterSpacing: -0.15 },
  cardSub: { fontFamily: font.medium, fontSize: 12, color: colors.sub, marginTop: 1 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  cardChevrons: { marginLeft: 'auto', flexDirection: 'row' },
  cardManageWrap: { paddingHorizontal: 12, paddingBottom: 12 },
});
