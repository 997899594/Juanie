'use client';

import { usePathname } from 'next/navigation';
import { GlobalAIPanel } from './global-ai-panel';
import { Header } from './header';
import { MobileBottomNav } from './mobile-bottom-nav';
import { Sidebar } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white/35 to-transparent" />
        <div className="console-grid absolute inset-x-4 top-4 h-56 rounded-[32px] opacity-70 blur-[0.5px] lg:left-[15.5rem] lg:right-6" />
      </div>
      <Sidebar />
      <div className="min-h-screen lg:pl-60">
        <div className="lg:hidden">
          <Header />
        </div>
        <main className="relative px-4 pb-24 pt-5 md:px-6 lg:pb-8 lg:pt-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
      <GlobalAIPanel />
      <MobileBottomNav />
    </div>
  );
}
