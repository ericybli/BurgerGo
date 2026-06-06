import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import en from '@/messages/en.json';

// Only English ships in Plan 1A; zh.json + the toggle arrive in a later plan.
const SUPPORTED = ['en'] as const;
type Locale = (typeof SUPPORTED)[number];

function resolveLocale(cookieValue: string | undefined): Locale {
  if (cookieValue && (SUPPORTED as readonly string[]).includes(cookieValue)) {
    return cookieValue as Locale;
  }
  return 'en';
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get('BURGERGO_LOCALE')?.value);
  return {
    locale,
    messages: en,
  };
});
