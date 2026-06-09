'use client';

import { useTranslations } from 'next-intl';
import { formatMoney } from '@/src/lib/currency';
import { clampPercent, type BudgetRow, type BudgetCategory } from '@/src/lib/budgetView';

type Props = {
  overall: BudgetRow;
  categories: BudgetRow[];
  currency: string;
  locale: string;
  onSetBudget: () => void;
};

function RemainingLabel({
  row,
  currency,
  locale,
}: {
  row: BudgetRow;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('budget');
  if (row.planned === null) {
    return <span className="text-caption text-faint">{t('noTarget')}</span>;
  }
  if (row.over) {
    return (
      <span className="text-caption font-semibold text-danger">
        {t('overBudget', { amount: formatMoney(Math.abs(row.remaining ?? 0), currency, locale) })}
      </span>
    );
  }
  return (
    <span className="text-caption text-faint">
      {t('remaining', { amount: formatMoney(row.remaining ?? 0, currency, locale) })}
    </span>
  );
}

function Bar({
  testId,
  row,
  label,
}: {
  testId: string;
  row: BudgetRow;
  label: string;
}) {
  const width = clampPercent(row.percent);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      className="mt-1.5 h-[5px] w-full overflow-hidden rounded-[3px] bg-surface"
    >
      <div
        data-testid={testId}
        className={`h-full rounded-[3px] transition-[width] duration-500 ease-spring ${row.over ? 'bg-danger' : 'bg-accent'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function BudgetSummary({ overall, categories, currency, locale, onSetBudget }: Props) {
  const t = useTranslations('budget');

  return (
    <section className="rounded-[16px] border border-line bg-bg px-4 py-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-micro uppercase text-faint">{t('overall')}</h2>
        <button
          type="button"
          onClick={onSetBudget}
          className="rounded-control border border-line bg-bg px-3.5 py-2 text-label text-ink transition hover:bg-surface active:opacity-70"
        >
          {overall.planned === null ? t('setBudget') : t('editBudget')}
        </button>
      </div>

      <p className="mt-2 text-[30px] font-extrabold tracking-[-0.03em] text-ink [font-variant-numeric:tabular-nums]">
        {overall.planned === null
          ? formatMoney(overall.spent, currency, locale)
          : t('spentOfPlanned', {
              spent: formatMoney(overall.spent, currency, locale),
              planned: formatMoney(overall.planned, currency, locale),
            })}
      </p>
      <Bar testId="bar-overall" row={overall} label={t('overall')} />
      <p className="mt-1">
        <RemainingLabel row={overall} currency={currency} locale={locale} />
      </p>

      <ul className="mt-3 flex flex-col">
        {categories.map((row) => (
          <li key={row.category} className="border-b border-line py-[9px] last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                {t(`categories.${row.category as BudgetCategory}`)}
              </span>
              <span className="shrink-0 text-body font-semibold text-sub [font-variant-numeric:tabular-nums]">
                {row.planned === null
                  ? formatMoney(row.spent, currency, locale)
                  : t('spentOfPlanned', {
                      spent: formatMoney(row.spent, currency, locale),
                      planned: formatMoney(row.planned, currency, locale),
                    })}
              </span>
            </div>
            <Bar
              testId={`bar-${row.category}`}
              row={row}
              label={t(`categories.${row.category as BudgetCategory}`)}
            />
            <p className="mt-1 text-right">
              <RemainingLabel row={row} currency={currency} locale={locale} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
