import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/EmptyState';

// Placeholder tab — statically cacheable for any trip id so it loads offline.
export const dynamic = 'force-static';

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
