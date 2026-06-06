import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/EmptyState';

export default async function BudgetPage() {
  const t = await getTranslations();
  return (
    <EmptyState
      mascotAlt={t('mascot.alt')}
      headline={t('comingSoon.budget')}
      subtext={t('comingSoon.subtext')}
    />
  );
}
