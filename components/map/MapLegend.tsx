'use client';

import { useTranslations } from 'next-intl';

export interface LegendEntry {
  date: string;
  dayNumber: number;
  color: string;
  visible: boolean;
}

/**
 * Horizontal legend chips for the Plan▸Map per-day visibility filter
 * (spec §3.4). Purely presentational: "All days" toggle + one chip per day
 * (color swatch + "Day N"), reflecting visibility via aria-pressed and
 * forwarding taps to the PlanMap handlers. Returns null for the Saved bucket
 * (no days to filter).
 */
export function MapLegend({
  entries,
  allVisible,
  onSelectDay,
  onToggleAll,
}: {
  entries: LegendEntry[];
  allVisible: boolean;
  onSelectDay: (date: string) => void;
  onToggleAll: () => void;
}) {
  const t = useTranslations('planMap');
  if (entries.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t('legendLabel')}
      className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={allVisible}
        onClick={onToggleAll}
        className={`shrink-0 rounded-chip border px-3 py-1.5 text-caption font-medium shadow-hair backdrop-blur-sm transition-[transform,background-color,box-shadow,color] duration-200 ease-spring active:scale-95 ${
          allVisible
            ? 'border-coral bg-coral-tint text-coral'
            : 'border-line bg-card/90 text-ink-muted hover:bg-line'
        }`}
      >
        {t('allDays')}
      </button>

      {entries.map((e) => (
        <button
          key={e.date}
          type="button"
          aria-pressed={e.visible}
          onClick={() => onSelectDay(e.date)}
          className={`flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-caption font-medium shadow-hair backdrop-blur-sm transition-[transform,background-color,box-shadow,color] duration-200 ease-spring hover:bg-line active:scale-95 ${
            e.visible ? 'border-line bg-card/90 text-ink' : 'border-line bg-card/90 text-ink-faint'
          }`}
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-chip"
            style={{
              backgroundColor: e.visible ? e.color : 'transparent',
              boxShadow: `inset 0 0 0 2px ${e.color}`,
            }}
          />
          {t('dayChip', { n: e.dayNumber })}
        </button>
      ))}
    </div>
  );
}
