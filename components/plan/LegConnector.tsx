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
  online,
  onModeChange,
}: {
  leg: LegDTO | undefined;
  mode: TravelMode;
  /** Offline → mode switching disabled (mutations are online-only). */
  disabled: boolean;
  /** Online but no cached leg → Google returned no route (vs. offline → reconnect to compute). */
  online: boolean;
  onModeChange: (mode: TravelMode) => void;
}) {
  const t = useTranslations('plan');
  return (
    <div className="relative py-2 pl-[2.125rem]">
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-[11px] top-0 border-l-2 border-dotted border-line"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11.5px] text-sub [font-variant-numeric:tabular-nums]">{formatLeg(leg)}</span>
        {leg ? null : <span className="text-[11.5px] text-faint">{online ? t('legNoRoute') : t('legNeedsConnection')}</span>}
        <div role="group" className="flex items-center gap-2.5">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onModeChange(m)}
                className={`border-b-2 pb-px text-[11.5px] font-semibold transition active:opacity-70 disabled:opacity-40 ${
                  active ? 'border-accent text-accent' : 'border-transparent text-faint hover:text-sub'
                }`}
              >
                {t(LABEL_KEY[m])}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
