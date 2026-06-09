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
        <span className="text-caption font-medium text-ink-muted">{t('defaultMode')}</span>
        <div role="group" className="flex rounded-control bg-paper p-0.5 shadow-inset">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(m)}
                className={`rounded-control px-3 py-1.5 text-caption font-medium transition-[transform,box-shadow,background-color,color] duration-200 ease-spring active:scale-95 disabled:opacity-40 ${
                  active ? 'bg-card text-coral shadow-card' : 'text-ink-muted hover:text-ink'
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
          className="rounded-control px-2 py-1 text-caption font-medium text-teal transition hover:bg-teal-tint active:scale-95"
        >
          {t('recompute')}
        </button>
      )}
    </div>
  );
}
