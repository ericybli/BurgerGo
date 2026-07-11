import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LayoutGrid, Rows3 } from 'lucide-react-native';
import type { Place, TravelMode } from '../../lib/api';
import { colors, font } from '../../lib/theme';
import { Button, EmptyState, Sheet } from '../../components/ui';
import { useEnter } from '../../components/ui/motion';
import { categoryLabel, formatDayItinerary, legFor, type LegLookup } from './planShared';
import { PlaceCard, type PlaceDensity } from './PlaceCard';
import { LegConnector } from './LegConnector';
import { DayModeControl } from './DayModeControl';
import { ExportDaySheet } from './ExportDaySheet';

const DENSITY_KEY = 'bg.itineraryDensity';

/** Pure reorder: move the item at `from` to `to`, preserving the rest. */
export function reorderIds(ids: string[], from: number, to: number): string[] {
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return ids;
  next.splice(to, 0, moved);
  return next;
}

/**
 * Itinerary stagger (handoff #1): each visible row enters translateY(18)→0 +
 * fade, delay i×45ms (capped after 12 rows so long days don't crawl). Replays
 * on day change because the wrapper is keyed by the day's date (useEnter is
 * mount-only by design); reduce-motion renders the final state directly
 * inside useEnter.
 */
function StaggerIn({ index, children }: { index: number; children: ReactNode }) {
  const enter = useEnter(Math.min(index, 12) * 45, 18);
  return <Animated.View style={enter}>{children}</Animated.View>;
}

type DayItineraryProps = {
  dayLabel: string; // "Day 2"
  dayDate: string; // YYYY-MM-DD (text-export header)
  dayTitle: string | null;
  onSaveDayTitle: (title: string | null) => void;
  stops: Place[]; // ordered by orderIndex
  legs: LegLookup;
  mode: TravelMode;
  dayColor: string;
  disabled: boolean;
  busy: boolean;
  online: boolean;
  onAddPlace: () => void;
  onAddFromSaved: () => void;
  onReorder: (orderedIds: string[]) => void;
  onTapPlace: (place: Place) => void;
  onViewPlace: (place: Place) => void;
  onMoveToSaved: (place: Place) => void;
  onMoveToDay: (place: Place) => void;
  onCopyToDay: (place: Place) => void;
  onDelete: (place: Place) => void;
  onModeChange: (mode: TravelMode) => void;
  /** Per-leg mode: sets the mode of the leg arriving at `place`. */
  onLegModeChange: (place: Place, mode: TravelMode) => void;
  onRecompute: () => void;
};

/** One selected day's itinerary (web DayItinerary): header row with tap-to-edit
 *  title + density toggle, DayModeControl, stops with leg connectors, footer. */
export function DayItinerary({
  dayLabel,
  dayDate,
  dayTitle,
  onSaveDayTitle,
  stops,
  legs,
  mode,
  dayColor,
  disabled,
  busy,
  online,
  onAddPlace,
  onAddFromSaved,
  onReorder,
  onTapPlace,
  onViewPlace,
  onMoveToSaved,
  onMoveToDay,
  onCopyToDay,
  onDelete,
  onModeChange,
  onLegModeChange,
  onRecompute,
}: DayItineraryProps) {
  const [exportOpen, setExportOpen] = useState(false);

  // Tap-to-edit day title: inline input replaces the heading text while open.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  function commitTitle() {
    setEditingTitle(false);
    const next = titleDraft.trim() || null;
    if (next !== (dayTitle ?? null)) onSaveDayTitle(next);
  }

  // Close any in-flight title edit when the selected day changes.
  useEffect(() => {
    setEditingTitle(false);
  }, [dayDate]);

  // Itinerary density: compact rows vs large cards, remembered across visits.
  const [density, setDensity] = useState<PlaceDensity>('cards');
  useEffect(() => {
    AsyncStorage.getItem(DENSITY_KEY)
      .then((stored) => {
        if (stored === 'rows' || stored === 'cards') setDensity(stored);
      })
      .catch(() => {});
  }, []);
  function changeDensity(next: PlaceDensity) {
    setDensity(next);
    AsyncStorage.setItem(DENSITY_KEY, next).catch(() => {});
  }

  function move(place: Place, dir: 'up' | 'down') {
    const ids = stops.map((s) => s.id);
    const from = ids.indexOf(place.id);
    const to = dir === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return;
    onReorder(reorderIds(ids, from, to));
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        {editingTitle ? (
          <TextInput
            value={titleDraft}
            autoFocus
            placeholder="Add a title…"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Day title"
            onChangeText={setTitleDraft}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            onKeyPress={(e) => {
              // Escape cancels (react-native-web surfaces it; native keyboards don't).
              if ((e.nativeEvent as { key?: string }).key === 'Escape') setEditingTitle(false);
            }}
            returnKeyType="done"
            style={styles.titleInput}
          />
        ) : (
          <Pressable
            disabled={disabled}
            accessibilityLabel="Day title"
            onPress={() => {
              setTitleDraft(dayTitle ?? '');
              setEditingTitle(true);
            }}
            style={[styles.titleBtn, disabled && { opacity: 0.6 }]}
          >
            <Text style={[styles.titleText, !dayTitle && styles.titlePlaceholder]} numberOfLines={1}>
              {dayTitle ?? 'Add a title…'}
            </Text>
          </Pressable>
        )}
        <View style={styles.densityTrack}>
          <Pressable
            accessibilityLabel="Compact rows"
            accessibilityState={{ selected: density === 'rows' }}
            onPress={() => changeDensity('rows')}
            style={[styles.densityBtn, density === 'rows' && styles.densityBtnActive]}
          >
            <Rows3 size={13} color={density === 'rows' ? colors.ink : colors.faint} />
          </Pressable>
          <Pressable
            accessibilityLabel="Large cards"
            accessibilityState={{ selected: density === 'cards' }}
            onPress={() => changeDensity('cards')}
            style={[styles.densityBtn, density === 'cards' && styles.densityBtnActive]}
          >
            <LayoutGrid size={13} color={density === 'cards' ? colors.ink : colors.faint} />
          </Pressable>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <DayModeControl
          mode={mode}
          disabled={!online}
          busy={busy}
          onChange={onModeChange}
          onRecompute={onRecompute}
        />
      </View>

      {stops.length === 0 ? (
        <View>
          <EmptyState
            headline={`Nothing planned for ${dayLabel} yet`}
            subtext="Add your first stop, or pull one in from Saved."
            action={disabled ? undefined : <Button title="Add place" onPress={onAddPlace} />}
          />
          {online ? (
            <Pressable onPress={onAddFromSaved} style={styles.centerLink}>
              <Text style={styles.centerLinkText}>Add from Saved</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View>
          {/* Day timeline: a single vertical rail (dayColor) threads the
              numbered stop nodes; leg pills hang between them on hollow nodes.
              PlaceCard renders in `timeline` mode (no internal pin) so cards
              fill the lane to the right of the rail. */}
          <View style={styles.timeline}>
            <View style={[styles.rail, { backgroundColor: dayColor }]} pointerEvents="none" />
            {stops.map((stop, i) => {
              const prev = stops[i - 1];
              const legMode = stop.legMode ?? mode;
              return (
                <Fragment key={stop.id}>
                  {prev ? (
                    // Wrapper keys carry the day's date so a day switch remounts
                    // the rows and replays the entrance (list keying — the
                    // stop.id Fragment key — is unchanged).
                    <StaggerIn key={`leg-${dayDate}`} index={i * 2 - 1}>
                      <View style={styles.legRow}>
                        <View style={styles.legNode} pointerEvents="none" />
                        <LegConnector
                          leg={legFor(legs, prev.id, stop.id, legMode)}
                          mode={legMode}
                          disabled={disabled}
                          online={online}
                          onModeChange={(m) => onLegModeChange(stop, m)}
                        />
                      </View>
                    </StaggerIn>
                  ) : null}
                  <StaggerIn key={`stop-${dayDate}`} index={i * 2}>
                    <View style={styles.stopRow}>
                      <View style={[styles.node, { backgroundColor: dayColor }]}>
                        <Text style={styles.nodeText}>{stop.orderIndex + 1}</Text>
                      </View>
                      <PlaceCard
                        timeline
                        place={stop}
                        pinNumber={stop.orderIndex + 1}
                        pinColor={dayColor}
                        density={density}
                        disabled={disabled}
                        isFirst={i === 0}
                        isLast={i === stops.length - 1}
                        onTap={() => onTapPlace(stop)}
                        onView={() => onViewPlace(stop)}
                        onMoveUp={() => move(stop, 'up')}
                        onMoveDown={() => move(stop, 'down')}
                        onMoveToSaved={() => onMoveToSaved(stop)}
                        onMoveToDay={() => onMoveToDay(stop)}
                        onCopyToDay={() => onCopyToDay(stop)}
                        onDelete={() => onDelete(stop)}
                      />
                    </View>
                  </StaggerIn>
                </Fragment>
              );
            })}
          </View>

          <View style={styles.footerRow}>
            <Button title="Add place" onPress={onAddPlace} disabled={disabled} style={{ flex: 1 }} />
            <Button title="Add from Saved" variant="secondary" onPress={onAddFromSaved} disabled={disabled} style={{ flex: 1 }} />
          </View>
          <Pressable onPress={() => setExportOpen(true)} style={styles.centerLink}>
            <Text style={styles.exportText}>Copy day as text</Text>
          </Pressable>
        </View>
      )}

      <Sheet visible={exportOpen} onClose={() => setExportOpen(false)}>
        {exportOpen ? (
          <ExportDaySheet
            text={formatDayItinerary(
              `${dayLabel} · ${dayDate}`,
              stops.map((s) => ({
                name: s.name,
                category: categoryLabel(s.category),
                time: s.scheduledTime,
                address: s.address,
              })),
            )}
            onClose={() => setExportOpen(false)}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayLabel: { fontFamily: font.bold, fontSize: 13, color: colors.ink },
  titleBtn: { flex: 1, minWidth: 0 },
  titleText: { fontFamily: font.regular, fontSize: 12.5, color: colors.sub },
  titlePlaceholder: { color: colors.faint },
  titleInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.ink,
  },
  densityTrack: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, padding: 2, gap: 1 },
  densityBtn: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  densityBtnActive: {
    backgroundColor: colors.bg,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  timeline: { position: 'relative', paddingLeft: 38 },
  rail: { position: 'absolute', left: 15, top: 10, bottom: 26, width: 2, opacity: 0.5 },
  stopRow: { position: 'relative' },
  node: {
    position: 'absolute',
    left: -33,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  nodeText: { color: colors.white, fontFamily: font.bold, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  legRow: { position: 'relative' },
  legNode: {
    position: 'absolute',
    left: -30,
    top: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.line,
    zIndex: 2,
  },

  footerRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  centerLink: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
  centerLinkText: { fontFamily: font.semibold, fontSize: 13, color: colors.accent },
  exportText: { fontFamily: font.semibold, fontSize: 12, color: colors.sub },
});
