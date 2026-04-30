'use client';

import { usePathname } from 'next/navigation';
import { buildEnvironmentNavHref, environmentNav } from '@/components/layout/navigation';
import { SectionNav } from '@/components/ui/section-nav';

export function EnvironmentSectionNav({
  projectId,
  environmentId,
}: {
  projectId: string;
  environmentId?: string | null;
}) {
  const pathname = usePathname();

  const baseHref = environmentId
    ? `/projects/${projectId}/environments/${environmentId}`
    : `/projects/${projectId}/environments`;

  return (
    <SectionNav
      className="lg:hidden"
      size="sm"
      tone="inverted"
      items={environmentNav.map((item) => {
        const href = environmentId
          ? buildEnvironmentNavHref(projectId, environmentId, item.href)
          : `${baseHref}${item.href}`;
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
