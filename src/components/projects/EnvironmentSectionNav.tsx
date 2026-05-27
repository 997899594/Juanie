'use client';

import { usePathname } from 'next/navigation';
import { buildEnvironmentNavHref, environmentNav } from '@/components/layout/navigation';
import { SectionNav } from '@/components/ui/section-nav';

export function EnvironmentSectionNav({
  projectId,
  environmentId,
  audience = 'full',
}: {
  projectId: string;
  environmentId?: string | null;
  audience?: 'full' | 'delivery';
}) {
  const pathname = usePathname();

  if (!environmentId) {
    return null;
  }

  const baseHref = `/projects/${projectId}/environments/${environmentId}`;

  return (
    <SectionNav
      className="lg:hidden"
      size="sm"
      tone="inverted"
      items={environmentNav
        .filter((item) => (audience === 'delivery' ? item.href === '/delivery' : true))
        .map((item) => {
          const href = buildEnvironmentNavHref(projectId, environmentId, item.href);
          const isActive =
            item.href === ''
              ? pathname === baseHref
              : pathname === href || pathname.startsWith(`${href}/`);

          return {
            href,
            icon: item.icon,
            isActive,
            label: item.title,
          };
        })}
    />
  );
}
