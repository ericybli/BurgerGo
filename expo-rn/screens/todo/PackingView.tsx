/**
 * Packing-list tab (web parity: components/packing/PackingClient.tsx +
 * PackingCategorySection.tsx + PackingItemRow.tsx). Categories with items
 * (name, quantity, packed checkbox). Mutations are online-only; offline is the
 * only global freeze — every card/row owns its own busy flag so one mutation
 * never locks the rest of the list. Atlas Light: white cards, hairline `line`
 * borders/dividers, accent checkboxes, accent-outline "Add", secondary
 * "Add category" (not orange — it isn't the section's primary creator).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { api, type PackingCategory, type PackingItem } from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
import { Loading } from '../../components/ui';
import { CheckBox, MascotEmpty, SureLabel, useTwoTapConfirm } from './shared';

/** Web coercion `max(1, floor(Number(v) || 1))` + client-side 9999 cap. */
function coerceQty(value: string): number {
  return Math.min(9999, Math.max(1, Math.floor(Number(value) || 1)));
}

export function PackingView() {
  const { tripId } = useTrip();
  const online = useOnline();
  const [categories, setCategories] = useState<PackingCategory[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false); // guards only the add-category row
  const [newCat, setNewCat] = useState('');
  const [catFocused, setCatFocused] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.packing.list(tripId);
      setCategories(r.categories);
      setError(false);
    } catch {
      setError(true);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCategory() {
    const name = newCat.trim();
    if (!name || !online || busy) return;
    setBusy(true);
    try {
      await api.packing.addCategory(tripId, name);
      setNewCat(''); // clear only after success — failed adds keep the text
      await load();
    } catch {
      // Surfaced via the next reload.
    } finally {
      setBusy(false);
    }
  }

  // Error replaces the WHOLE tab, add row included (web early-return).
  if (error) {
    return (
      <MascotEmpty
        alt="Packing list"
        headline="Couldn't load your packing list"
        subtext="Connect to the internet and try again."
      />
    );
  }
  if (categories === null) return <Loading label="Loading your packing list…" />;

  const addFrozen = busy || !online;
  const canAdd = !addFrozen && newCat.trim() !== '';

  return (
    <View>
      <View style={st.addRow}>
        <TextInput
          style={[st.addInput, catFocused && st.inputFocusAccent, addFrozen && st.dim60]}
          value={newCat}
          onChangeText={setNewCat}
          placeholder="New category (e.g. Clothes)"
          placeholderTextColor={colors.faint}
          maxLength={100}
          editable={!addFrozen}
          onFocus={() => setCatFocused(true)}
          onBlur={() => setCatFocused(false)}
          onSubmitEditing={addCategory}
          returnKeyType="done"
        />
        <Pressable
          onPress={addCategory}
          disabled={!canAdd}
          style={({ pressed }) => [
            st.secondaryBtn,
            pressed && canAdd && { backgroundColor: colors.surface },
            !canAdd && st.dim40,
          ]}
        >
          <Text style={st.secondaryBtnText}>Add category</Text>
        </Pressable>
      </View>

      {categories.length === 0 ? (
        <MascotEmpty
          alt="Packing list"
          headline="Nothing to pack yet"
          subtext="Create a category, then add things to bring."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} disabled={!online} onChanged={load} tripId={tripId} />
          ))}
        </View>
      )}
    </View>
  );
}

function CategoryCard({
  category,
  disabled,
  onChanged,
  tripId,
}: {
  category: PackingCategory;
  disabled: boolean; // offline — the only global freeze
  onChanged: () => void;
  tripId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [nameFocused, setNameFocused] = useState(false);
  const [qtyFocused, setQtyFocused] = useState(false);

  const packedCount = category.items.filter((i) => i.packed).length;
  const frozen = disabled || busy;

  async function addItem() {
    const name = newItem.trim();
    if (!name || frozen) return;
    const quantity = coerceQty(newQty);
    setBusy(true);
    try {
      await api.packing.addItem(tripId, category.id, name, quantity);
      setNewItem('');
      setNewQty('1');
      onChanged();
    } catch {
      // Surfaced via the next reload.
    } finally {
      setBusy(false);
    }
  }

  const del = useTwoTapConfirm(() => {
    setBusy(true);
    api.packing
      .deleteCategory(tripId, category.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  });

  const canAddItem = !frozen && newItem.trim() !== '';

  return (
    <View style={st.catCard}>
      <View style={st.catHeader}>
        <Text style={st.catName} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={st.counter}>
          {packedCount}/{category.items.length}
        </Text>
        <Pressable
          hitSlop={8}
          disabled={frozen}
          onPress={del.fire}
          accessibilityLabel={`Delete ${category.name} and its items`}
          style={frozen ? st.dim40 : undefined}
        >
          {del.armed ? <SureLabel /> : <Trash2 size={14} color={colors.faint} />}
        </Pressable>
      </View>

      {category.items.length > 0 ? (
        <View>
          {category.items.map((item, i) => (
            <View key={item.id} style={i > 0 ? st.divider : undefined}>
              <ItemRow item={item} disabled={disabled} onChanged={onChanged} tripId={tripId} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={st.itemAddRow}>
        <TextInput
          style={[st.itemNameInput, nameFocused && st.inputFocusAccent, frozen && st.dim60]}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add an item"
          placeholderTextColor={colors.faint}
          maxLength={100}
          editable={!frozen}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TextInput
          style={[st.qtyAddInput, qtyFocused && st.inputFocusAccent, frozen && st.dim60]}
          value={newQty}
          onChangeText={setNewQty}
          accessibilityLabel="Quantity"
          keyboardType="number-pad"
          maxLength={4}
          editable={!frozen}
          onFocus={() => setQtyFocused(true)}
          onBlur={() => setQtyFocused(false)}
          textAlign="center"
        />
        <Pressable
          onPress={addItem}
          disabled={!canAddItem}
          style={({ pressed }) => [
            st.itemAddBtn,
            pressed && canAddItem && { backgroundColor: colors.accentTint },
            !canAddItem && st.dim40,
          ]}
        >
          <Text style={st.itemAddText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ItemRow({
  item,
  disabled,
  onChanged,
  tripId,
}: {
  item: PackingItem;
  disabled: boolean;
  onChanged: () => void;
  tripId: string;
}) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [busy, setBusy] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [qtyFocused, setQtyFocused] = useState(false);

  // Re-seed from props after each reload (server is the source of truth).
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setQty(String(item.quantity)), [item.quantity]);

  const frozen = disabled || busy;

  async function save(patch: Partial<{ name: string; quantity: number; packed: boolean }>) {
    setBusy(true);
    try {
      await api.packing.updateItem(tripId, item.id, patch);
      onChanged();
    } catch {
      // A failed save leaves the row; the next reload re-syncs.
    } finally {
      setBusy(false);
    }
  }

  function commitName() {
    setNameFocused(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.name) {
      setName(item.name); // revert empty/unchanged edits
      return;
    }
    void save({ name: trimmed });
  }

  function commitQty() {
    setQtyFocused(false);
    const n = coerceQty(qty);
    setQty(String(n));
    if (n !== item.quantity) void save({ quantity: n });
  }

  const del = useTwoTapConfirm(() => {
    setBusy(true);
    api.packing
      .deleteItem(tripId, item.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  });

  return (
    <View style={st.itemRow}>
      <CheckBox
        checked={item.packed}
        onToggle={() => void save({ packed: !item.packed })}
        disabled={frozen}
        accessibilityLabel={`Packed: ${item.name}`}
      />
      <TextInput
        style={[
          st.itemName,
          item.packed && st.itemNamePacked,
          nameFocused && st.inlineFocus,
          frozen && st.dim60,
        ]}
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!frozen}
        onFocus={() => setNameFocused(true)}
        onBlur={commitName}
        onSubmitEditing={commitName}
        returnKeyType="done"
      />
      <TextInput
        style={[st.itemQty, qtyFocused && st.qtyFocus, frozen && st.dim60]}
        value={qty}
        onChangeText={setQty}
        accessibilityLabel="Quantity"
        keyboardType="number-pad"
        maxLength={4}
        editable={!frozen}
        textAlign="center"
        onFocus={() => setQtyFocused(true)}
        onBlur={commitQty}
        onSubmitEditing={commitQty}
      />
      <Pressable
        hitSlop={8}
        disabled={frozen}
        onPress={del.fire}
        accessibilityLabel="Delete item"
        style={frozen ? st.dim40 : undefined}
      >
        {del.armed ? <SureLabel /> : <Text style={st.removeX}>✕</Text>}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  dim40: { opacity: 0.4 },
  dim60: { opacity: 0.6 },
  inputFocusAccent: { borderColor: colors.accent },

  // Add-category row
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  addInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.ink,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryBtnText: { ...type.label, color: colors.sub },

  // Category card
  catCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catName: {
    flex: 1,
    minWidth: 0,
    ...type.micro,
    textTransform: 'uppercase',
    color: colors.faint,
  },
  counter: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.sub,
    fontVariant: ['tabular-nums'],
  },

  // Item rows
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.control,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itemNamePacked: { textDecorationLine: 'line-through', color: colors.faint },
  inlineFocus: { borderColor: colors.line, backgroundColor: colors.bg },
  itemQty: {
    width: 38,
    fontSize: 12.5,
    fontFamily: font.semibold,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  qtyFocus: { backgroundColor: colors.bg, borderColor: colors.accent },
  removeX: { fontSize: 15, fontFamily: font.regular, color: colors.faint, paddingHorizontal: 2 },

  // Add-item row
  itemAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  itemNameInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    fontFamily: font.regular,
    color: colors.ink,
  },
  qtyAddInput: {
    width: 38,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 2,
    paddingVertical: 8,
    fontSize: 12.5,
    fontFamily: font.regular,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  itemAddBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemAddText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.accent },
});
