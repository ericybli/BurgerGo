import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Noto_Sans_SC } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SWRegister } from '@/components/SWRegister';
import { OfflineBanner } from '@/components/OfflineBanner';
import { withBase } from '@/src/lib/basePath';
import './globals.css';

// Atlas Light UI face — Instrument Sans (variable weights), exposed as
// `--font-instrument` and resolved by Tailwind `font-sans` via --font-sans.
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
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
  themeColor: '#FFFFFF',
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
    <html lang="en" className={`${instrument.variable} ${notoSansSC.variable}`}>
      <body className="min-h-[100dvh] bg-bg font-sans text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <OfflineBanner />
          {children}
          <SWRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
