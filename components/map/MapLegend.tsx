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
        className={`shrink-0 whitespace-nowrap rounded-chip border px-3 py-1.5 text-caption font-semibold transition-[transform,background-color,border-color,color] duration-200 ease-spring active:scale-95 ${
          allVisible
            ? 'border-ink bg-ink text-white'
            : 'border-line bg-bg text-sub hover:bg-surface'
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
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border px-3 py-1.5 text-caption font-semibold transition-[transform,background-color,border-color,color] duration-200 ease-spring active:scale-95 ${
            e.visible
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-bg text-sub hover:bg-surface'
          }`}
        >
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] rounded-chip"
            style={{ backgroundColor: e.visible ? '#FFFFFF' : e.color }}
          />
          {t('dayChip', { n: e.dayNumber })}
        </button>
      ))}
    </div>
  );
}
