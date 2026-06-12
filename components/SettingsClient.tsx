'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { APP_VERSION } from '@/src/lib/appVersion';
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROMPT, AI_MODELS } from '@/src/lib/openai/defaults';
import { updateAiSettingsAction, updateCurrencyAction, updateMapSettingsAction } from '@/app/_actions/settings';
import { CURRENCIES } from '@/src/lib/currency';
import { ProfileCard } from '@/components/ProfileCard';

type SettingsRow = {
  language: string;
  currency: string;
  aiPrompt: string | null;
  aiModel: string | null;
  clusterPins: boolean | null;
} | null;

/**
 * Settings data owner. The page is a static shell; this client fetches the
 * read-only `/api/settings` row (SWR-cached by the SW) so it works offline.
 * Language/currency stay read-only placeholders (1A); the About block is
 * fully static — i18n strings + a build-time version literal, no I/O.
 */
export function SettingsClient() {
  const t = useTranslations();
  const [online, setOnline] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODEL);
  const [aiStatus, setAiStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [currency, setCurrency] = useState('USD');
  const [curStatus, setCurStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  // Map pin clustering: on by default (null/true → true); only false turns it off.
  const [clusterPins, setClusterPins] = useState(true);
  const [mapStatus, setMapStatus] = useState<'idle' | 'saved' | 'error'>('idle');
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
          setCurrency(row?.currency ?? 'USD');
          setClusterPins(row?.clusterPins !== false);
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

  function saveCurrency(next: string) {
    setCurrency(next);
    setCurStatus('idle');
    startTransition(async () => {
      try {
        await updateCurrencyAction({ currency: next });
        setCurStatus('saved');
      } catch {
        setCurStatus('error');
      }
    });
  }

  function saveCluster(next: boolean) {
    setClusterPins(next);
    setMapStatus('idle');
    startTransition(async () => {
      try {
        await updateMapSettingsAction({ clusterPins: next });
        setMapStatus('saved');
      } catch {
        setClusterPins(!next); // revert optimistic toggle on failure
        setMapStatus('error');
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <header className="flex items-center gap-2 py-2">
        <Link
          href="/"
          aria-label={t('trip.back')}
          className="flex h-11 w-11 items-center justify-center rounded-chip text-ink transition hover:bg-surface active:scale-95"
        >
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-title text-ink">{t('settings.title')}</h1>
      </header>

      <ProfileCard />

      <section className="mt-4 rounded-card border border-line bg-bg p-4">
        <div className="flex items-center justify-between">
          <span className="text-body text-ink">{t('settings.language')}</span>
          <span className="text-label text-sub">{t('settings.languageEnglish')}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-body text-ink">{t('settings.currency')}</span>
          <select
            aria-label={t('settings.currency')}
            value={currency}
            disabled={!online || isPending}
            onChange={(e) => saveCurrency(e.target.value)}
            className="rounded-control border border-line bg-bg px-3 py-1.5 text-label text-ink transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
            {/* Keep a stored value that isn't in the common list selectable. */}
            {CURRENCIES.some((c) => c.code === currency) ? null : (
              <option value={currency}>{currency}</option>
            )}
          </select>
        </div>
        {curStatus === 'saved' ? (
          <p className="mt-2 text-caption text-accent">{t('settings.currencySaved')}</p>
        ) : curStatus === 'error' ? (
          <p className="mt-2 text-caption text-danger">{t('settings.saveError')}</p>
        ) : (
          <p className="mt-2 text-caption text-faint">{t('settings.currencyHint')}</p>
        )}
      </section>

      <section className="mt-4 rounded-card border border-line bg-bg p-4">
        <p className="text-heading text-ink">{t('settings.mapTitle')}</p>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-control -mx-2 px-2 py-1 transition-colors hover:bg-accent-tint/40">
          <span className="min-w-0">
            <span className="block text-body text-ink">{t('settings.clusterLabel')}</span>
            <span className="mt-0.5 block text-caption text-sub">{t('settings.clusterHint')}</span>
          </span>
          <input
            type="checkbox"
            aria-label={t('settings.clusterLabel')}
            checked={clusterPins}
            disabled={!online || isPending}
            onChange={(e) => saveCluster(e.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-accent transition disabled:opacity-60"
          />
        </label>
        {mapStatus === 'saved' ? (
          <p className="mt-2 text-caption text-accent">{t('settings.mapSaved')}</p>
        ) : mapStatus === 'error' ? (
          <p className="mt-2 text-caption text-danger">{t('settings.saveError')}</p>
        ) : null}
      </section>

      <section className="mt-4 rounded-card border border-line bg-bg p-4">
        <p className="text-heading text-ink">{t('settings.aiTitle')}</p>
        <p className="mt-1 text-caption text-sub">{t('settings.aiBody')}</p>

        <label className="mt-3 block text-caption font-medium text-ink" htmlFor="ai-model">
          {t('settings.aiModelLabel')}
        </label>
        <select
          id="ai-model"
          value={aiModel}
          disabled={!online || isPending}
          onChange={(e) => { setAiModel(e.target.value); setAiStatus('idle'); }}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
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
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-caption text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />
        <p className="mt-1 text-caption text-faint">{t('settings.aiPromptHint')}</p>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!online || isPending}
            onClick={saveAi}
            className="inline-flex items-center justify-center rounded-control bg-orange px-3.5 py-2 text-label text-white transition hover:bg-orange-press active:scale-[0.98] active:bg-orange-press disabled:bg-surface disabled:text-faint"
          >
            {t('settings.aiSave')}
          </button>
          <button
            type="button"
            disabled={!online || isPending}
            onClick={resetAi}
            className="rounded-control px-2 py-1 text-label text-accent transition active:opacity-70 disabled:opacity-40"
          >
            {t('settings.aiReset')}
          </button>
          {aiStatus === 'saved' ? (
            <span role="status" className="text-caption text-sub">{t('settings.aiSaved')}</span>
          ) : null}
          {aiStatus === 'error' ? (
            <span role="alert" className="text-caption text-danger">{t('settings.aiSaveFailed')}</span>
          ) : null}
        </div>
      </section>

      <section className="mt-4 rounded-card border border-line bg-bg p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase('/burgergo-logo.png')}
          alt={t('mascot.alt')}
          width={88}
          height={88}
          className="mx-auto h-[88px] w-[88px] opacity-90"
        />
        <p className="mt-3 text-heading text-ink">{t('app.name')}</p>
        <p className="mt-1 text-caption text-sub">{t('settings.aboutTagline')}</p>
        <p className="mt-2 text-caption text-faint [font-variant-numeric:tabular-nums]">
          {t('settings.aboutVersion', { version: APP_VERSION })}
        </p>
      </section>

      <section className="mt-4 rounded-card border border-line bg-bg p-4">
        <div>
          <p className="text-heading text-ink">{t('settings.offlineInstallTitle')}</p>
          <p className="mt-1 text-caption text-sub">{t('settings.offlineInstallBody')}</p>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-heading text-ink">{t('settings.yourDataTitle')}</p>
          <p className="mt-1 text-caption text-sub">{t('settings.yourDataBody')}</p>
          <p className="mt-1 text-caption text-faint">{t('settings.yourDataBackup')}</p>
        </div>
      </section>
    </main>
  );
}
