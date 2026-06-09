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
    <div className="flex flex-col items-center gap-5 px-4 py-16 text-center">
      <p className="text-title text-ink">{t('routeError')}</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-line bg-bg px-6 py-3 text-label text-ink transition hover:bg-surface active:opacity-70"
      >
        {tCommon('retry')}
      </button>
    </div>
  );
}
