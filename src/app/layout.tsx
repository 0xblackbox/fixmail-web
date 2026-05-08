import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FixMail - 免费临时邮箱',
  description: '免费一次性临时邮箱，10分钟自动销毁，保护你的隐私',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-[#f9f9f8] min-h-screen">{children}</body>
    </html>
  );
}
