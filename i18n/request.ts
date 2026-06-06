import { getRequestConfig } from 'next-intl/server';
import en from '@/messages/en.json';

// Only English ships in Plan 1A. We intentionally do NOT read the locale cookie
// here: reading `cookies()` is a dynamic server API that opts every route into
// dynamic rendering (no-store), which would block the offline-read promise — the
// static page shells could never be SW-cached. Returning a static locale keeps the
// whole tree statically renderable (and SW-cacheable). The cookie-driven zh toggle
// arrives in a later plan, alongside per-locale handling that won't force-dynamic
// the cacheable read surfaces. (spec §7.3/§8.2)
const SUPPORTED = ['en'] as const;
type Locale = (typeof SUPPORTED)[number];

const DEFAULT_LOCALE: Locale = 'en';

export default getRequestConfig(async () => {
  return {
    locale: DEFAULT_LOCALE,
    messages: en,
  };
});
