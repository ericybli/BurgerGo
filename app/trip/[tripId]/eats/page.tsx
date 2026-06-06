import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/EmptyState';

export default async function EatsPage() {
  const t = await getTranslations();
  return (
    <EmptyState
      mascotAlt={t('mascot.alt')}
      headline={t('comingSoon.eats')}
      subtext={t('comingSoon.subtext')}
    />
  );
}
