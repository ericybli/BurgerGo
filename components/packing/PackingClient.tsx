'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { addCategoryAction } from '@/app/_actions/packing';
import type { PackingCategoryDTO } from '@/app/api/trips/[tripId]/packing/route';
import { EmptyState } from '@/components/EmptyState';
import { PackingCategorySection } from '@/components/packing/PackingCategorySection';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; categories: PackingCategoryDTO[] };

/**
 * Packing-list tab (static shell + client-fetch). Lists user-created categories,
 * each with its items (name, quantity, packed checkbox). Mutations are
 * online-only Server Actions; reads work offline from the SW data cache.
 */
export function PackingClient({ tripId }: { tripId: string }) {
  const t = useTranslations('packing');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase(`/api/trips/${tripId}/packing`), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load failed');
      const { categories } = (await res.json()) as { categories: PackingCategoryDTO[] };
      if (mountedRef.current) setState({ status: 'loaded', categories });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddCategory() {
    const name = newCat.trim();
    if (!name || !online) return;
    setBusy(true);
    try {
      await addCategoryAction(tripId, name);
      setNewCat('');
      await load();
    } catch {
      // Surfaced via reload.
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-sub">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('title')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { categories } = state;

  return (
    <div>
      <div className="mb-4 mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newCat}
          disabled={!online || busy}
          placeholder={t('categoryNamePlaceholder')}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAddCategory();
          }}
          className="min-w-0 flex-1 rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />
        <button
          type="button"
          disabled={!online || busy || newCat.trim() === ''}
          onClick={() => void handleAddCategory()}
          className="inline-flex shrink-0 items-center justify-center rounded-control border border-line bg-bg px-3.5 py-2 text-label text-sub transition hover:bg-surface active:opacity-70 disabled:opacity-40"
        >
          {t('addCategory')}
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState mascotAlt={t('title')} headline={t('empty.headline')} subtext={t('empty.subtext')} />
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((c) => (
            <PackingCategorySection key={c.id} category={c} disabled={!online} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
