'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Standardized connectivity banner (spec §3.7, §7.6). Driven by navigator.onLine +
 * 'online'/'offline' events. Ink strip; copy from messages (bilingual-ready). Hidden online.
 */
export function OfflineBanner() {
  const t = useTranslations('offline');
  // Start "online" so SSR markup is empty and hydration matches; correct on mount.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-ink px-4 py-2 text-center text-caption font-medium text-white"
    >
      {t('banner')}
    </div>
  );
}
