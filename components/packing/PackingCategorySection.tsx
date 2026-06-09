'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { addItemAction, deleteCategoryAction } from '@/app/_actions/packing';
import type { PackingCategoryDTO } from '@/app/api/trips/[tripId]/packing/route';
import { PackingItemRow } from '@/components/packing/PackingItemRow';

/**
 * One packing category card: title + packed-progress + delete, the list of
 * items, and an "add item" row (name + quantity). Deleting the category removes
 * its items too (FK cascade). Online-only; `disabled` freezes the controls.
 */
export function PackingCategorySection({
  category,
  disabled,
  onChanged,
}: {
  category: PackingCategoryDTO;
  disabled: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('packing');
  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [busy, setBusy] = useState(false);

  const packedCount = category.items.filter((i) => i.packed).length;

  async function handleAddItem() {
    const name = newItem.trim();
    if (!name || disabled) return;
    const quantity = Math.max(1, Math.floor(Number(newQty) || 1));
    setBusy(true);
    try {
      await addItemAction({ categoryId: category.id, name, quantity });
      setNewItem('');
      setNewQty('1');
      onChanged();
    } catch {
      // Surfaced via the next reload.
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteCategory() {
    setBusy(true);
    deleteCategoryAction(category.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <section className="rounded-card bg-card p-3 shadow-card shadow-hair">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-micro font-semibold uppercase tracking-wide text-ink-muted">{category.name}</h2>
        <span className="shrink-0 text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
          {packedCount}/{category.items.length}
        </span>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={handleDeleteCategory}
          aria-label={t('deleteCategory', { name: category.name })}
          className="flex shrink-0 items-center justify-center rounded-chip p-1 text-ink-faint transition hover:bg-line active:scale-95 active:bg-line disabled:opacity-40"
        >
          🗑
        </button>
      </div>

      {category.items.length > 0 ? (
        <div className="divide-y divide-line">
          {category.items.map((i) => (
            <PackingItemRow key={i.id} item={i} disabled={disabled} onChanged={onChanged} />
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={newItem}
          disabled={disabled || busy}
          placeholder={t('itemNamePlaceholder')}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAddItem();
          }}
          className="min-w-0 flex-1 rounded-control border border-line bg-paper px-2 py-1.5 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={newQty}
          disabled={disabled || busy}
          aria-label={t('quantityLabel')}
          onChange={(e) => setNewQty(e.target.value)}
          className="w-14 shrink-0 rounded-control border border-line bg-paper px-2 py-1.5 text-center text-body text-ink [font-variant-numeric:tabular-nums] transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled || busy || newItem.trim() === ''}
          onClick={() => void handleAddItem()}
          className="inline-flex shrink-0 items-center justify-center rounded-control border border-teal px-3 py-1.5 text-caption font-medium text-teal transition hover:bg-teal-tint active:scale-[0.98] active:bg-teal-tint disabled:opacity-40"
        >
          {t('addItem')}
        </button>
      </div>
    </section>
  );
}
