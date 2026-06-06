'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type SettingsRow = { language: string; currency: string } | null;

/**
 * Settings data owner. The page is a static shell; this client fetches the
 * read-only `/api/settings` row (SWR-cached by the SW) so it works offline.
 * Read-only placeholder display as in 1A — no controls yet.
 */
export function SettingsClient() {
  const t = useTranslations();
  const [settings, setSettings] = useState<SettingsRow>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/settings', { credentials: 'same-origin' });
        if (!res.ok) return;
        const row = (await res.json()) as SettingsRow;
        if (!cancelled) setSettings(row);
      } catch {
        // Offline with no cached settings → keep the en/USD placeholder defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      <section className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/burgergo-logo.png"
          alt={t('mascot.alt')}
          width={88}
          height={88}
          className="mx-auto h-[88px] w-[88px] opacity-90"
        />
        <p className="mt-3 text-heading font-semibold text-ink">{t('app.name')}</p>
        <p className="mt-1 text-caption text-ink-muted">{t('settings.aboutTagline')}</p>
      </section>
    </main>
  );
}
