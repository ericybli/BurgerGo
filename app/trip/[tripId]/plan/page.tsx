import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/EmptyState';

export default async function PlanPage() {
  const t = await getTranslations();
  return (
    <EmptyState
      mascotAlt={t('mascot.alt')}
      headline={t('comingSoon.plan')}
      subtext={t('comingSoon.subtext')}
    />
  );
}
