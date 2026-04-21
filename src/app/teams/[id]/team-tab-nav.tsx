'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { label: '概览', href: '' },
  { label: '成员', href: '/members' },
  { label: '集成', href: '/integrations' },
  { label: '设置', href: '/settings' },
];

export function TeamTabNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();

  return (
    <div className="ui-floating flex flex-wrap items-center gap-2 px-3 py-3">
      {tabs.map((tab) => {
        const href = `/teams/${teamId}${tab.href}`;
        const isActive = tab.href === '' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-white/80 hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
