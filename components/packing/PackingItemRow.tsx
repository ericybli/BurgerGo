'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateItemAction, deleteItemAction, type UpdateItemActionPatch } from '@/app/_actions/packing';
import type { PackingItem } from '@/src/db/repos/packing';

/**
 * One packing item: a leading packed-checkbox, an inline-editable name, an
 * inline-editable quantity, and a delete button. Name/quantity save on blur (or
 * Enter); the checkbox toggles immediately. Mutations are online-only — `disabled`
 * (offline) freezes every control. Local state re-syncs from the prop after each
 * reload so the server stays the source of truth.
 */
export function PackingItemRow({
  item,
  disabled,
  onChanged,
}: {
  item: PackingItem;
  disabled: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('packing');
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setQty(String(item.quantity)), [item.quantity]);

  async function save(patch: UpdateItemActionPatch) {
    setBusy(true);
    try {
      await updateItemAction(item.id, patch);
      onChanged();
    } catch {
      // A failed save leaves the row; the next reload re-syncs from the server.
    } finally {
      setBusy(false);
    }
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.name) {
      setName(item.name); // revert empty/unchanged edits
      return;
    }
    void save({ name: trimmed });
  }

  function commitQty() {
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    setQty(String(n));
    if (n !== item.quantity) void save({ quantity: n });
  }

  function handleDelete() {
    setBusy(true);
    deleteItemAction(item.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <input
        type="checkbox"
        checked={item.packed}
        disabled={disabled || busy}
        aria-label={t('packedLabel', { name: item.name })}
        onChange={(e) => void save({ packed: e.target.checked })}
        className="h-5 w-5 shrink-0 accent-teal"
      />
      <input
        type="text"
        value={name}
        disabled={disabled || busy}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-body text-ink focus:border-line focus:bg-paper disabled:opacity-60 ${
          item.packed ? 'text-ink-faint line-through' : ''
        }`}
      />
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={qty}
        disabled={disabled || busy}
        aria-label={t('quantityLabel')}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-14 shrink-0 rounded-control border border-line bg-paper px-2 py-1 text-center text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={handleDelete}
        aria-label={t('deleteItem')}
        className="shrink-0 rounded-chip p-1 text-ink-faint active:bg-line disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );
}
