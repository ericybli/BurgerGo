'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const TABS = ['plan', 'eats', 'budget', 'packing', 'journal'] as const;
type Tab = (typeof TABS)[number];

export function BottomTabBar({ tripId }: { tripId: string }) {
  const t = useTranslations('tabs');
  const pathname = usePathname();

  function isActive(tab: Tab): boolean {
    return pathname === `/trip/${tripId}/${tab}` || pathname.startsWith(`/trip/${tripId}/${tab}/`);
  }

  return (
    <nav
      aria-label="Trip sections"
      className="flex shrink-0 border-t border-line bg-card shadow-lift [padding-bottom:env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab}
            href={`/trip/${tripId}/${tab}`}
            // The tab bar is always on screen, so default prefetch eagerly
            // fetches all four sibling tabs' RSC payloads on every trip page
            // load — requests that compete with the critical data fetch. Each
            // tab client re-fetches its own data on navigation anyway, so the
            // prefetch buys little; disable it. (perf)
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 text-label font-medium transition-colors duration-200 active:scale-95 ${
              active ? 'text-coral' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 mx-auto h-[3px] w-8 rounded-chip bg-coral shadow-[0_1px_4px_var(--coral-tint)]"
              />
            ) : null}
            {t(tab)}
          </Link>
        );
      })}
    </nav>
  );
}
