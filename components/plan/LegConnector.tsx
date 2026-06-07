'use client';

import { useTranslations } from 'next-intl';
import type { LegDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { formatLeg } from '@/src/lib/legView';

const MODES: TravelMode[] = ['walk', 'drive', 'transit'];
const LABEL_KEY: Record<TravelMode, 'travelModeWalk' | 'travelModeDrive' | 'travelModeTransit'> = {
  walk: 'travelModeWalk',
  drive: 'travelModeDrive',
  transit: 'travelModeTransit',
};

/**
 * Slim leg connector between two Place cards (spec §3.4) with a per-leg travel
 * -mode segmented control. The active mode is this leg's own mode (the
 * destination place's `legMode`, falling back to the day default); switching it
 * recomputes just this segment. `leg` is the cached leg for the active mode.
 */
export function LegConnector({
  leg,
  mode,
  disabled,
  onModeChange,
}: {
  leg: LegDTO | undefined;
  mode: TravelMode;
  /** Offline → mode switching disabled (mutations are online-only). */
  disabled: boolean;
  onModeChange: (mode: TravelMode) => void;
}) {
  const t = useTranslations('plan');
  return (
    <div className="-mt-2 mb-1 flex flex-col gap-1 pl-[1.625rem]">
      <div role="group" className="flex w-fit rounded-control bg-card p-0.5 shadow-inset">
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onModeChange(m)}
              className={`rounded-control px-2 py-0.5 text-caption font-medium disabled:opacity-40 ${
                active ? 'bg-coral text-white' : 'text-ink-muted'
              }`}
            >
              {t(LABEL_KEY[m])}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-caption text-ink-muted">
        <span className="[font-variant-numeric:tabular-nums]">{formatLeg(leg)}</span>
        {leg ? null : <span className="text-ink-faint">{t('legNeedsConnection')}</span>}
      </div>
    </div>
  );
}
