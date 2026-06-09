import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Fraunces, Noto_Sans_SC } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SWRegister } from '@/components/SWRegister';
import { OfflineBanner } from '@/components/OfflineBanner';
import { withBase } from '@/src/lib/basePath';
import './globals.css';

// Body / UI face — a warm, highly legible grotesque (replaces Inter, the
// default-looking AI sans). Variable weight range, exposed as `--font-hanken`.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

// Display / headline face — a soft optical serif with editorial character.
// `opsz` lets large headings auto-pick the display cut; `SOFT`/`WONK` round the
// terminals for warmth (set via font-variation-settings in globals.css).
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz', 'SOFT', 'WONK'],
});

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BurgerGo',
  description: 'Your personal travel-planning assistant.',
  manifest: withBase('/manifest.webmanifest'),
  appleWebApp: {
    capable: true,
    title: 'BurgerGo',
    statusBarStyle: 'default',
  },
  icons: {
    apple: withBase('/icons/apple-touch-icon.png'),
  },
};

export const viewport: Viewport = {
  themeColor: '#EE5B3C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${fraunces.variable} ${notoSansSC.variable}`}
    >
      <body className="min-h-[100dvh] bg-paper font-sans text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <OfflineBanner />
          {children}
          <SWRegister />
        </NextIntlClientProvider>
        {/* Fixed film-grain overlay — adds tactile texture to flat surfaces.
            Decorative + pointer-events-none, so it never intercepts input. */}
        <div className="grain-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
