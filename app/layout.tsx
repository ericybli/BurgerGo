import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_SC } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SWRegister } from '@/components/SWRegister';
import { OfflineBanner } from '@/components/OfflineBanner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'BurgerGo',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
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
    <html lang="en" className={`${inter.variable} ${notoSansSC.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <OfflineBanner />
          {children}
          <SWRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
