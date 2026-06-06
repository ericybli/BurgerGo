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
    return <span className="text-caption text-ink-faint">{t('noTarget')}</span>;
  }
  if (row.over) {
    return (
      <span className="text-caption font-medium text-red-600">
        {t('overBudget', { amount: formatMoney(Math.abs(row.remaining ?? 0), currency, locale) })}
      </span>
    );
  }
  return (
    <span className="text-caption text-ink-muted">
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
      className="mt-1 h-2 w-full overflow-hidden rounded-chip bg-paper shadow-inset"
    >
      <div
        data-testid={testId}
        className={`h-full rounded-chip ${row.over ? 'bg-red-500' : 'bg-coral'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function BudgetSummary({ overall, categories, currency, locale, onSetBudget }: Props) {
  const t = useTranslations('budget');

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-heading font-semibold text-ink">{t('overall')}</h2>
        <button
          type="button"
          onClick={onSetBudget}
          className="rounded-control bg-paper px-3 py-1.5 text-caption font-medium text-ink shadow-inset"
        >
          {overall.planned === null ? t('setBudget') : t('editBudget')}
        </button>
      </div>

      <p className="mt-2 text-body text-ink [font-variant-numeric:tabular-nums]">
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

      <ul className="mt-4 flex flex-col gap-3">
        {categories.map((row) => (
          <li key={row.category}>
            <div className="flex items-center justify-between">
              <span className="text-label font-medium text-ink">
                {t(`categories.${row.category as BudgetCategory}`)}
              </span>
              <span className="text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
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
            <p className="mt-1">
              <RemainingLabel row={row} currency={currency} locale={locale} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
