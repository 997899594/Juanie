'use client';

import { usePathname } from 'next/navigation';
import { SectionNav } from '@/components/ui/section-nav';

const tabs = [
  { label: '个人资料', href: '/settings' },
  { label: '集成', href: '/settings/integrations' },
];

export function SettingsTabNav() {
  const pathname = usePathname();

  return (
    <SectionNav
      items={tabs.map((tab) => ({
        ...tab,
        isActive: pathname === tab.href,
      }))}
    />
  );
}
