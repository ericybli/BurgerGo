'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
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
    <div className="flex items-center gap-2.5 py-2">
      <span className="relative flex h-[21px] w-[21px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={item.packed}
          disabled={disabled || busy}
          aria-label={t('packedLabel', { name: item.name })}
          onChange={(e) => void save({ packed: e.target.checked })}
          className="peer h-[21px] w-[21px] shrink-0 cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-faint bg-bg transition checked:border-accent checked:bg-accent disabled:opacity-40"
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition peer-checked:opacity-100"
        />
      </span>
      <input
        type="text"
        value={name}
        disabled={disabled || busy}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-[14px] transition-colors focus:border-line focus:bg-bg focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60 ${
          item.packed ? 'text-faint line-through' : 'text-ink'
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
        className="min-w-[30px] w-[38px] shrink-0 rounded-lg border border-transparent bg-surface px-1 py-1 text-center text-[12.5px] font-semibold text-ink [font-variant-numeric:tabular-nums] transition focus:border-accent focus:bg-bg focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={handleDelete}
        aria-label={t('deleteItem')}
        className="flex shrink-0 items-center justify-center rounded-chip p-1 text-faint transition hover:bg-surface active:scale-95 active:text-danger disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );
}
