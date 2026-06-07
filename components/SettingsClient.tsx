'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { APP_VERSION } from '@/src/lib/appVersion';
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROMPT, AI_MODELS } from '@/src/lib/openai/defaults';
import { updateAiSettingsAction } from '@/app/_actions/settings';

type SettingsRow = {
  language: string;
  currency: string;
  aiPrompt: string | null;
  aiModel: string | null;
} | null;

/**
 * Settings data owner. The page is a static shell; this client fetches the
 * read-only `/api/settings` row (SWR-cached by the SW) so it works offline.
 * Language/currency stay read-only placeholders (1A); the About block is
 * fully static — i18n strings + a build-time version literal, no I/O.
 */
export function SettingsClient() {
  const t = useTranslations();
  const [settings, setSettings] = useState<SettingsRow>(null);
  const [online, setOnline] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODEL);
  const [aiStatus, setAiStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isPending, startTransition] = useTransition();

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
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(withBase('/api/settings'), { credentials: 'same-origin' });
        if (!res.ok) return;
        const row = (await res.json()) as SettingsRow;
        if (!cancelled) {
          setSettings(row);
          setAiPrompt(row?.aiPrompt ?? '');
          // Coerce any stored value to one of the dropdown options (else default).
          setAiModel(row?.aiModel && AI_MODELS.includes(row.aiModel) ? row.aiModel : DEFAULT_AI_MODEL);
        }
      } catch {
        // Offline with no cached settings → keep the en/USD placeholder defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function saveAi() {
    setAiStatus('idle');
    startTransition(async () => {
      try {
        await updateAiSettingsAction({ prompt: aiPrompt, model: aiModel });
        setAiStatus('saved');
      } catch {
        setAiStatus('error');
      }
    });
  }

  function resetAi() {
    setAiPrompt('');
    setAiModel(DEFAULT_AI_MODEL);
    setAiStatus('idle');
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <header className="flex items-center gap-2 py-2">
        <Link
          href="/"
          aria-label={t('trip.back')}
          className="flex h-11 w-11 items-center justify-center rounded-chip text-ink"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-title font-bold text-ink">{t('settings.title')}</h1>
      </header>

      <section className="mt-2 rounded-card bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-body text-ink">{t('settings.language')}</span>
          <span className="text-label font-medium text-ink-muted">
            {settings?.language ?? 'en'}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-body text-ink">{t('settings.currency')}</span>
          <span className="text-label font-medium text-ink-muted [font-variant-numeric:tabular-nums]">
            {settings?.currency ?? 'USD'}
          </span>
        </div>
        <p className="mt-3 text-caption text-ink-faint">{t('settings.comingSoon')}</p>
      </section>

      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <p className="text-label font-medium text-ink">{t('settings.aiTitle')}</p>
        <p className="mt-1 text-caption text-ink-muted">{t('settings.aiBody')}</p>

        <label className="mt-3 block text-caption font-medium text-ink" htmlFor="ai-model">
          {t('settings.aiModelLabel')}
        </label>
        <select
          id="ai-model"
          value={aiModel}
          disabled={!online || isPending}
          onChange={(e) => { setAiModel(e.target.value); setAiStatus('idle'); }}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          {AI_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <label className="mt-3 block text-caption font-medium text-ink" htmlFor="ai-prompt">
          {t('settings.aiPromptLabel')}
        </label>
        <textarea
          id="ai-prompt"
          rows={8}
          value={aiPrompt}
          disabled={!online || isPending}
          placeholder={DEFAULT_AI_PROMPT}
          onChange={(e) => { setAiPrompt(e.target.value); setAiStatus('idle'); }}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-caption text-ink disabled:opacity-60"
        />
        <p className="mt-1 text-caption text-ink-faint">{t('settings.aiPromptHint')}</p>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!online || isPending}
            onClick={saveAi}
            className="rounded-control bg-coral px-4 py-2 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('settings.aiSave')}
          </button>
          <button
            type="button"
            disabled={!online || isPending}
            onClick={resetAi}
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {t('settings.aiReset')}
          </button>
          {aiStatus === 'saved' ? (
            <span role="status" className="text-caption text-ink-muted">{t('settings.aiSaved')}</span>
          ) : null}
          {aiStatus === 'error' ? (
            <span role="alert" className="text-caption text-red-700">{t('settings.aiSaveFailed')}</span>
          ) : null}
        </div>
      </section>

      <section className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase('/burgergo-logo.png')}
          alt={t('mascot.alt')}
          width={88}
          height={88}
          className="mx-auto h-[88px] w-[88px] opacity-90"
        />
        <p className="mt-3 text-heading font-semibold text-ink">{t('app.name')}</p>
        <p className="mt-1 text-caption text-ink-muted">{t('settings.aboutTagline')}</p>
        <p className="mt-2 text-caption text-ink-faint [font-variant-numeric:tabular-nums]">
          {t('settings.aboutVersion', { version: APP_VERSION })}
        </p>
      </section>

      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <div>
          <p className="text-label font-medium text-ink">{t('settings.offlineInstallTitle')}</p>
          <p className="mt-1 text-caption text-ink-muted">{t('settings.offlineInstallBody')}</p>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-label font-medium text-ink">{t('settings.yourDataTitle')}</p>
          <p className="mt-1 text-caption text-ink-muted">{t('settings.yourDataBody')}</p>
          <p className="mt-1 text-caption text-ink-faint">{t('settings.yourDataBackup')}</p>
        </div>
      </section>
    </main>
  );
}
