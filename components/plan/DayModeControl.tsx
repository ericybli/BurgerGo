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
        <div role="group" className="flex rounded-control bg-card p-0.5 shadow-inset">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(m)}
                className={`rounded-control px-3 py-1.5 text-caption font-medium disabled:opacity-40 ${
                  active ? 'bg-coral text-white' : 'text-ink-muted'
                }`}
              >
                {t(LABEL_KEY[m])}
              </button>
            );
          })}
        </div>
      </div>
      {disabled ? null : (
        <button type="button" onClick={onRecompute} className="text-caption font-medium text-teal">
          {t('recompute')}
        </button>
      )}
    </div>
  );
}
