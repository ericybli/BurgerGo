'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'burgergo.onboarded';

/**
 * First-run welcome note on the home screen (U1). Explains what BurgerGo is and —
 * importantly — that it's read-only offline and the in-app map can look blank
 * without a connection (so that isn't mistaken for a bug). Dismissed once, then
 * remembered in localStorage. Renders nothing on the server / before hydration to
 * avoid a flash, and nothing once dismissed.
 */
export function OnboardingNote() {
  const t = useTranslations('home');
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      /* no storage (private mode) → just don't show */
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <section className="mb-4 rounded-card bg-card p-4 shadow-card">
      <h2 className="text-label font-semibold text-ink">{t('onboardTitle')}</h2>
      <p className="mt-1 text-caption leading-relaxed text-ink-muted">{t('onboardBody')}</p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 rounded-control bg-coral px-4 py-2 text-caption font-medium text-white active:bg-coral-press"
      >
        {t('onboardDismiss')}
      </button>
    </section>
  );
}
