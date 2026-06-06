'use client';

import { useTranslations } from 'next-intl';

/**
 * Next.js error boundary for the Plan route.
 * Catches uncaught Server Action / render errors as a backstop.
 */
export default function PlanError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('plan');
  const tCommon = useTranslations('common');

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <p className="text-body text-ink">{t('routeError')}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-control bg-coral px-6 py-3 text-label font-medium text-white shadow-card active:bg-coral-press"
      >
        {tCommon('retry')}
      </button>
    </div>
  );
}
