'use client';

import { usePathname } from 'next/navigation';
import { PlatformNavItem } from '@/components/ui/platform-navigation';
import { isNavItemActive, mobileMainNav } from './navigation';

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2 lg:hidden">
      <nav className="glass grid grid-cols-3 gap-1 rounded-[24px] p-1 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_12px_32px_rgba(15,23,42,0.08)]">
        {mobileMainNav.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <PlatformNavItem
              key={item.href}
              href={item.href}
              icon={Icon}
              label={item.title}
              active={isActive}
              tone="bottom"
            />
          );
        })}
      </nav>
    </div>
  );
}
