import type { Metadata } from 'next';
import { IBM_Plex_Mono, Noto_Sans_SC } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const notoSansSc = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Juanie - AI DevOps Platform',
  description: 'Modern AI-driven DevOps platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${notoSansSc.variable} ${ibmPlexMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
