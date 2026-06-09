'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapPin, Utensils, CreditCard, SquareCheck, Book } from 'lucide-react';

const TABS = ['plan', 'eats', 'budget', 'packing', 'journal'] as const;
type Tab = (typeof TABS)[number];

// Atlas tab icons: 2px-stroke outline set (pin / fork+knife / card / checkbox / book).
const TAB_ICONS: Record<Tab, typeof MapPin> = {
  plan: MapPin,
  eats: Utensils,
  budget: CreditCard,
  packing: SquareCheck,
  journal: Book,
};

export function BottomTabBar({ tripId }: { tripId: string }) {
  const t = useTranslations('tabs');
  const pathname = usePathname();

  function isActive(tab: Tab): boolean {
    return pathname === `/trip/${tripId}/${tab}` || pathname.startsWith(`/trip/${tripId}/${tab}/`);
  }

  return (
    <nav
      aria-label="Trip sections"
      className="flex shrink-0 border-t border-line bg-bg [padding-bottom:env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const active = isActive(tab);
        const Icon = TAB_ICONS[tab];
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
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-[3px] py-2 transition-colors duration-200 active:scale-95 ${
              active ? 'text-accent' : 'text-faint hover:text-sub'
            }`}
          >
            <Icon size={21} strokeWidth={2} aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-none">{t(tab)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
