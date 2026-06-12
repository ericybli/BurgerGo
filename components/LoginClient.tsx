'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/src/lib/authClient';
import { withBase } from '@/src/lib/basePath';

/** Full-screen cream login field (Atlas splash recipe): logo + Google button. */
export function LoginClient() {
  const t = useTranslations('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(false);
    const { error: err } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: withBase('/'),
    });
    if (err) {
      setError(true);
      setBusy(false);
    }
    // success navigates away via redirect
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-cream px-6">
      {/* Bundled mascot (matches HomeClient) → plain <img>, basePath-safe. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase('/burgergo-logo.png')}
        alt=""
        width={96}
        height={96}
        className="h-24 w-24"
      />
      <h1 className="mt-4 text-[28px] font-bold tracking-[-0.02em] text-ink">BurgerGo</h1>
      <p className="mt-1 text-body text-sub">{t('tagline')}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void signIn()}
        className="mt-10 w-full max-w-xs rounded-[12px] border border-line bg-bg px-4 py-3 text-[15px] font-semibold text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-50"
      >
        {busy ? t('connecting') : t('continueWithGoogle')}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-caption font-medium text-danger">
          {t('error')}
        </p>
      ) : null}
    </main>
  );
}
