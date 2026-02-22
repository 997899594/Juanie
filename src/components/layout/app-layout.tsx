'use client';

import { usePathname } from 'next/navigation';
import { Header } from './header';
import { Sidebar } from './sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  projectName?: string;
  projectId?: string;
}

export function AppLayout({ children, projectName, projectId }: AppLayoutProps) {
  const pathname = usePathname();

  const isAuthPage = pathname === '/login';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar projectName={projectName} projectId={projectId} />
      <div className="pl-52 transition-all duration-200">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
