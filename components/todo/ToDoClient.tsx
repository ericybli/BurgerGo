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
      <div role="group" className="mt-2 flex rounded-control bg-card p-0.5 shadow-inset">
        <button
          type="button"
          aria-pressed={tab === 'packing'}
          onClick={() => setTab('packing')}
          className={`flex-1 rounded-control px-3 py-1.5 text-caption font-medium transition active:scale-[0.98] ${tab === 'packing' ? 'bg-coral text-white shadow-card' : 'text-ink-muted hover:text-ink'}`}
        >
          {t('packingTab')}
        </button>
        <button
          type="button"
          aria-pressed={tab === 'tasks'}
          onClick={() => setTab('tasks')}
          className={`flex-1 rounded-control px-3 py-1.5 text-caption font-medium transition active:scale-[0.98] ${tab === 'tasks' ? 'bg-coral text-white shadow-card' : 'text-ink-muted hover:text-ink'}`}
        >
          {t('tasksTab')}
        </button>
      </div>

      {tab === 'packing' ? <PackingClient tripId={tripId} /> : <TaskList tripId={tripId} />}
    </main>
  );
}
