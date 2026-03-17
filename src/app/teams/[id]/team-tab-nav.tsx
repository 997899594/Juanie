'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Overview', href: '' },
  { label: 'Members', href: '/members' },
  { label: 'Settings', href: '/settings' },
];

export function TeamTabNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b -mt-2">
      {tabs.map((tab) => {
        const href = `/teams/${teamId}${tab.href}`;
        const isActive = tab.href === '' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
