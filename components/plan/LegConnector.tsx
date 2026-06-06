'use client';

import { useTranslations } from 'next-intl';
import type { LegDTO } from '@/src/lib/planView';
import { formatLeg } from '@/src/lib/legView';

/** Slim leg connector between two Place cards (spec §3.4). */
export function LegConnector({ leg }: { leg: LegDTO | undefined }) {
  const t = useTranslations('plan');
  return (
    <div className="-mt-2 mb-1 flex items-center gap-2 pl-[1.625rem] text-caption text-ink-muted">
      <span className="[font-variant-numeric:tabular-nums]">{formatLeg(leg)}</span>
      {leg ? null : <span className="text-ink-faint">{t('legNeedsConnection')}</span>}
    </div>
  );
}
