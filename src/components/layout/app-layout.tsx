'use client';

import { usePathname } from 'next/navigation';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="min-h-screen pl-60">
        <Header />
        <main className="px-6 pb-6 pt-4">{children}</main>
      </div>
    </div>
  );
}
