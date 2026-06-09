import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Settings } from 'lucide-react';
import { withBase } from '@/src/lib/basePath';

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2">
          {/* Bundled logo asset → always renders offline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase('/burgergo-logo.png')}
            alt=""
            aria-hidden="true"
            width={38}
            height={36}
            className="h-9 w-[38px] object-contain"
          />
          <span className="text-display tracking-[-0.03em] text-ink">{t('home.title')}</span>
        </span>
        <Link
          href="/settings"
          aria-label={t('home.settings')}
          className="flex h-9 w-9 items-center justify-center rounded-chip bg-surface text-ink transition hover:bg-line active:scale-95"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
      </header>
      {children}
    </div>
  );
}
