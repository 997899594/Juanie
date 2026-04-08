import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Juanie - AI DevOps Platform',
  description: 'Modern AI-driven DevOps platform',
  icons: {
    icon: '/juanie-logo.png',
    apple: '/juanie-logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
