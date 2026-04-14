'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavItemActive, mobileMainNav } from './navigation';

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2 lg:hidden">
      <nav className="glass grid grid-cols-4 gap-1 rounded-[28px] border border-border/70 p-1.5 shadow-[0_-12px_32px_rgba(74,59,40,0.12)]">
        {mobileMainNav.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-[11px] font-medium transition-colors',
                isActive
                  ? 'bg-black text-white'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
