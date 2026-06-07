'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { addTaskAction } from '@/app/_actions/tasks';
import type { Task } from '@/src/db/repos/tasks';
import { EmptyState } from '@/components/EmptyState';
import { TaskRow } from '@/components/todo/TaskRow';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; tasks: Task[] };

/**
 * The To-do tab's Tasks section (static shell + client-fetch). Add a task by
 * title; each row has a checkbox (done → strikethrough), an editable note, and
 * delete. Mutations are online-only Server Actions; reads work offline from the
 * SW data cache.
 */
export function TaskList({ tripId }: { tripId: string }) {
  const t = useTranslations('tasks');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [newTitle, setNewTitle] = useState('');
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
      const res = await fetch(withBase(`/api/trips/${tripId}/tasks`), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load failed');
      const { tasks } = (await res.json()) as { tasks: Task[] };
      if (mountedRef.current) setState({ status: 'loaded', tasks });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title || !online) return;
    setBusy(true);
    try {
      await addTaskAction(tripId, title);
      setNewTitle('');
      await load();
    } catch {
      // Surfaced via reload.
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') {
    return <p className="py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('title')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { tasks } = state;

  return (
    <div>
      <div className="mb-4 mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          disabled={!online || busy}
          placeholder={t('taskPlaceholder')}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
          className="min-w-0 flex-1 rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />
        <button
          type="button"
          disabled={!online || busy || newTitle.trim() === ''}
          onClick={() => void handleAdd()}
          className="shrink-0 rounded-control bg-coral px-3 py-2 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('addTask')}
        </button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState mascotAlt={t('title')} headline={t('emptyHeadline')} subtext={t('emptySubtext')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} disabled={!online} onChanged={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
