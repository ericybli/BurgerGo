'use client';

import { useEffect } from 'react';
import { BASE_PATH, withBase } from '@/src/lib/basePath';

/**
 * Registers the Serwist-built service worker (<basePath>/sw.js) after first load
 * and asks the browser to persist storage so the offline trip cache resists
 * eviction (spec §7.2, §7.3). The SW scope is pinned to the basePath root
 * (`/burgergo/`, or `/` at root) so it controls the whole sub-app. Renders nothing.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register(withBase('/sw.js'), { scope: `${BASE_PATH}/` }).catch((err) => {
        console.error('SW registration failed:', err);
      });
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(() => {
          /* persistence is best-effort */
        });
      }
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
