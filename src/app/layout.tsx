import type { Metadata, Viewport } from 'next';
import LockProvider from '@/components/LockProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'FixMail - 免费临时邮箱',
  description: '免费一次性临时邮箱，保护你的隐私',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@300..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LockProvider>
          {children}
        </LockProvider>
      </body>
    </html>
  );
}
