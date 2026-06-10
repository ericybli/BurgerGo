import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import type { Place } from '../../lib/api';
import { colors, font, glyph } from '../../lib/theme';
import { thumbForPlace } from '../../lib/legView';
import { Button, EmptyState, Sheet } from '../../components/ui';
import { categoryLabel, useTwoTapConfirm } from './planShared';
import { PhotoPlaceholder } from './PhotoPlaceholder';
import { ListPickerSheet, type SavedListItem } from './ListPickerSheet';
import { ListNameSheet } from './ListNameSheet';

/** One saved-place card: tap to edit, Add to day + Manage (Move to list / Delete). */
function SavedPlaceCard({
  place,
  disabled,
  onTap,
  onAddToDay,
  onMoveToList,
  onDelete,
}: {
  place: Place;
  disabled: boolean;
  onTap: () => void;
  onAddToDay: () => void;
  onMoveToList: () => void;
  onDelete: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const del = useTwoTapConfirm(onDelete);
  const thumb = thumbForPlace(place, 'card');

  return (
    <View style={styles.card}>
      <Pressable onPress={onTap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.photo} resizeMode="cover" />
        ) : (
          <PhotoPlaceholder category={place.category} height={130} />
        )}
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text>{glyph(place.category)}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {place.name}
            </Text>
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {categoryLabel(place.category)}
            {place.address ? ` · ${place.address}` : ''}
          </Text>
          {place.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {place.notes}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          disabled={disabled}
          onPress={onAddToDay}
          style={({ pressed }) => [
            styles.addToDayBtn,
            pressed && !disabled && { backgroundColor: colors.orangePress },
            disabled && styles.addToDayDisabled,
          ]}
        >
          <Text style={[styles.addToDayText, disabled && { color: colors.faint }]}>Add to day</Text>
        </Pressable>
        <Pressable
          accessibilityState={{ expanded: managing }}
          onPress={() => {
            setManaging((v) => !v);
            del.disarm();
          }}
          style={({ pressed }) => [styles.manageBtn, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.manageText}>Manage</Text>
        </Pressable>
      </View>

      {managing ? (
        <View style={styles.manageRow}>
          <Pressable
            disabled={disabled}
            onPress={onMoveToList}
            style={({ pressed }) => [styles.pill, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pillAccent}>Move to list</Text>
          </Pressable>
          <Pressable
            disabled={disabled}
            onPress={del.fire}
            style={({ pressed }) => [styles.pill, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pillDanger}>{del.armed ? 'Sure? Delete' : 'Delete'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type NameSheetState =
  | { mode: 'createTop' }
  | { mode: 'createForPlace'; placeId: string }
  | { mode: 'rename'; listId: string; initialName: string }
  | null;

/**
 * Saved bucket (web SavedList): "+ New list…" dashed button, collapsible lists
 * (header row with ▸/▾ + count + ⋯ menu → Rename / 2-tap Delete), loose places
 * after the lists, and a footer "Add place".
 */
export function SavedList({
  saved,
  lists,
  disabled,
  onAddToDay,
  onTapPlace,
  onAddPlace,
  onMoveToList,
  onDelete,
  onCreateList,
  onRenameList,
  onDeleteList,
}: {
  saved: Place[];
  lists: SavedListItem[];
  disabled: boolean;
  /** Opens the day picker for this place ("Add to which day?"). */
  onAddToDay: (place: Place) => void;
  onTapPlace: (place: Place) => void;
  onAddPlace: () => void;
  onMoveToList: (placeId: string, listId: string | null) => void;
  onDelete: (place: Place) => void;
  /** Resolves with the created list so a place can be moved straight into it. */
  onCreateList: (name: string) => Promise<SavedListItem>;
  onRenameList: (listId: string, name: string) => void;
  onDeleteList: (listId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // collapsed by default
  const [listPickerFor, setListPickerFor] = useState<string | null>(null);
  const [nameSheet, setNameSheet] = useState<NameSheetState>(null);
  const [listMenuFor, setListMenuFor] = useState<string | null>(null);
  const deleteList = useTwoTapConfirm(() => {
    if (listMenuFor) {
      onDeleteList(listMenuFor);
      setListMenuFor(null);
    }
  });

  if (saved.length === 0 && lists.length === 0) {
    return (
      <EmptyState
        headline="No saved spots yet"
        subtext="Stash places you might want — promote them to a day later."
        action={disabled ? undefined : <Button title="Add place" onPress={onAddPlace} />}
      />
    );
  }

  const loose = saved.filter((p) => (p.listId ?? null) === null);
  const placesInList = (listId: string) => saved.filter((p) => p.listId === listId);
  const pickerPlace = listPickerFor ? (saved.find((p) => p.id === listPickerFor) ?? null) : null;

  function handleNameSubmit(name: string) {
    if (!nameSheet) return;
    if (nameSheet.mode === 'rename') {
      onRenameList(nameSheet.listId, name);
    } else if (nameSheet.mode === 'createForPlace') {
      const placeId = nameSheet.placeId;
      void onCreateList(name).then((l) => onMoveToList(placeId, l.id));
    } else {
      void onCreateList(name);
    }
  }

  const card = (p: Place) => (
    <SavedPlaceCard
      key={p.id}
      place={p}
      disabled={disabled}
      onTap={() => onTapPlace(p)}
      onAddToDay={() => onAddToDay(p)}
      onMoveToList={() => setListPickerFor(p.id)}
      onDelete={() => onDelete(p)}
    />
  );

  return (
    <View>
      <Pressable
        disabled={disabled}
        onPress={() => setNameSheet({ mode: 'createTop' })}
        style={({ pressed }) => [styles.newListBtn, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.newListText}>+ New list…</Text>
      </Pressable>

      {lists.map((list) => {
        const items = placesInList(list.id);
        const isOpen = expanded.has(list.id);
        return (
          <View key={list.id} style={{ marginTop: 14 }}>
            <View style={styles.listHeader}>
              <Pressable
                accessibilityState={{ expanded: isOpen }}
                onPress={() =>
                  setExpanded((cur) => {
                    const next = new Set(cur);
                    if (next.has(list.id)) next.delete(list.id);
                    else next.add(list.id);
                    return next;
                  })
                }
                style={styles.listHeaderMain}
              >
                <Text style={styles.listChevron}>{isOpen ? '▾' : '▸'}</Text>
                <Text style={styles.listName} numberOfLines={1}>
                  {list.name}
                </Text>
                <Text style={styles.listCount}>{items.length}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="List options"
                disabled={disabled}
                hitSlop={4}
                onPress={() => {
                  setListMenuFor((cur) => (cur === list.id ? null : list.id));
                  deleteList.disarm();
                }}
                style={[styles.listMenuBtn, disabled && { opacity: 0.4 }]}
              >
                <MoreHorizontal size={15} color={colors.faint} />
              </Pressable>
            </View>

            {listMenuFor === list.id ? (
              <View style={styles.listMenuRow}>
                <Pressable
                  onPress={() => {
                    setNameSheet({ mode: 'rename', listId: list.id, initialName: list.name });
                    setListMenuFor(null);
                  }}
                  style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.pillAccent}>Rename</Text>
                </Pressable>
                <Pressable
                  onPress={deleteList.fire}
                  style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.pillDanger}>
                    {deleteList.armed ? 'Delete list? Places stay' : 'Delete list'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {isOpen ? (
              items.length > 0 ? (
                <View style={styles.cardsCol}>{items.map(card)}</View>
              ) : (
                <Text style={styles.emptyListHint}>No places in this list yet.</Text>
              )
            ) : null}
          </View>
        );
      })}

      {loose.length > 0 ? <View style={[styles.cardsCol, { marginTop: 14 }]}>{loose.map(card)}</View> : null}

      <Button title="Add place" onPress={onAddPlace} disabled={disabled} style={{ marginTop: 16 }} />

      <Sheet visible={listPickerFor !== null} onClose={() => setListPickerFor(null)}>
        {listPickerFor !== null ? (
          <ListPickerSheet
            lists={lists}
            currentListId={pickerPlace?.listId ?? null}
            onPick={(listId) => {
              if (listPickerFor) onMoveToList(listPickerFor, listId);
            }}
            onNewList={() => {
              const placeId = listPickerFor;
              setListPickerFor(null);
              if (placeId) setNameSheet({ mode: 'createForPlace', placeId });
            }}
            onClose={() => setListPickerFor(null)}
          />
        ) : null}
      </Sheet>

      <Sheet visible={nameSheet !== null} onClose={() => setNameSheet(null)}>
        {nameSheet !== null ? (
          <ListNameSheet
            key={`${nameSheet.mode}-${'listId' in nameSheet ? nameSheet.listId : 'placeId' in nameSheet ? nameSheet.placeId : 'top'}`}
            title={nameSheet.mode === 'rename' ? 'Rename list' : 'New list'}
            submitLabel={nameSheet.mode === 'rename' ? 'Save' : 'Create'}
            initialName={nameSheet.mode === 'rename' ? nameSheet.initialName : ''}
            onSubmit={handleNameSubmit}
            onClose={() => setNameSheet(null)}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  newListBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  newListText: { fontFamily: font.semibold, fontSize: 13, color: colors.accent },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  listChevron: { fontSize: 13, color: colors.faint },
  listName: { flexShrink: 1, fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  listCount: {
    marginLeft: 'auto',
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
  listMenuBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  listMenuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  emptyListHint: { marginTop: 8, paddingHorizontal: 12, fontFamily: font.regular, fontSize: 12, color: colors.faint },

  cardsCol: { marginTop: 8, gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 130, backgroundColor: colors.surface },
  cardBody: { paddingHorizontal: 12, paddingTop: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink, letterSpacing: -0.15 },
  sub: { fontFamily: font.regular, fontSize: 12, color: colors.sub, marginTop: 1 },
  notes: { fontFamily: font.regular, fontSize: 12.5, color: colors.sub, marginTop: 4 },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  addToDayBtn: {
    borderRadius: 10,
    backgroundColor: colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  addToDayDisabled: { backgroundColor: colors.surface },
  addToDayText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.white },
  manageBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  manageText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.sub },

  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12, marginTop: -2 },
  pill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillAccent: { fontFamily: font.semibold, fontSize: 12.5, color: colors.accent },
  pillDanger: { fontFamily: font.semibold, fontSize: 12.5, color: colors.danger },
});
