'use client';

import { useTranslations } from 'next-intl';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

const MODES: TravelMode[] = ['walk', 'drive', 'transit'];
const LABEL_KEY: Record<TravelMode, 'travelModeWalk' | 'travelModeDrive' | 'travelModeTransit'> = {
  walk: 'travelModeWalk',
  drive: 'travelModeDrive',
  transit: 'travelModeTransit',
};

type DayModeControlProps = {
  mode: TravelMode;
  /** Offline → mode switching + recompute disabled/hidden. */
  disabled: boolean;
  onChange: (mode: TravelMode) => void;
  onRecompute: () => void;
};

export function DayModeControl({ mode, disabled, onChange, onRecompute }: DayModeControlProps) {
  const t = useTranslations('plan');
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">{t('defaultMode')}</span>
        <div role="group" className="flex gap-0.5 rounded-[10px] bg-surface p-[3px]">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(m)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-label transition disabled:opacity-40 ${
                  active ? 'bg-bg text-ink shadow-thumb' : 'text-sub'
                }`}
              >
                {t(LABEL_KEY[m])}
              </button>
            );
          })}
        </div>
      </div>
      {disabled ? null : (
        <button
          type="button"
          onClick={onRecompute}
          className="px-2 py-1 text-right text-[12.5px] font-semibold text-accent transition active:opacity-70"
        >
          {t('recompute')}
        </button>
      )}
    </div>
  );
}
