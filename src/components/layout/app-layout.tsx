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
      <div className="pl-52 transition-all duration-200">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
