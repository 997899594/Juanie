'use client';

import { usePathname } from 'next/navigation';
import { SectionNav } from '@/components/ui/section-nav';

const tabs = [
  { label: '概览', href: '' },
  { label: '成员', href: '/members' },
  { label: '集成', href: '/integrations' },
  { label: '设置', href: '/settings' },
];

export function TeamTabNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();

  return (
    <SectionNav
      items={tabs.map((tab) => {
        const href = `/teams/${teamId}${tab.href}`;
        return {
          href,
          isActive: tab.href === '' ? pathname === href : pathname.startsWith(href),
          label: tab.label,
        };
      })}
    />
  );
}
