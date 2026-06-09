'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PackingClient } from '@/components/packing/PackingClient';
import { TaskList } from '@/components/todo/TaskList';

type Tab = 'packing' | 'tasks';

/**
 * The "To do" tab: a segmented control switching between the Packing list (the
 * original categorized packing UI) and a simple Tasks list. Each sub-view owns
 * its own data fetch + mutations; this wrapper just provides the single <main>
 * and the tab switch.
 */
export function ToDoClient({ tripId }: { tripId: string }) {
  const t = useTranslations('todo');
  const [tab, setTab] = useState<Tab>('packing');

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div role="group" className="mt-2 flex gap-0.5 rounded-[10px] bg-surface p-[3px]">
        <button
          type="button"
          aria-pressed={tab === 'packing'}
          onClick={() => setTab('packing')}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-label transition ${tab === 'packing' ? 'bg-bg text-ink shadow-thumb' : 'text-sub'}`}
        >
          {t('packingTab')}
        </button>
        <button
          type="button"
          aria-pressed={tab === 'tasks'}
          onClick={() => setTab('tasks')}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-label transition ${tab === 'tasks' ? 'bg-bg text-ink shadow-thumb' : 'text-sub'}`}
        >
          {t('tasksTab')}
        </button>
      </div>

      {tab === 'packing' ? <PackingClient tripId={tripId} /> : <TaskList tripId={tripId} />}
    </main>
  );
}
