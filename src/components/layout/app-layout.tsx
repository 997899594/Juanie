'use client';

import { usePathname } from 'next/navigation';
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
      <Sidebar />
      <div className="min-h-screen lg:pl-60">
        <Header />
        <main className="px-4 pb-24 pt-4 md:px-6 lg:pb-6">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
