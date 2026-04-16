'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const runtimeNav = [
  { label: '概览', href: '' },
  { label: '变量', href: '/variables' },
  { label: '日志', href: '/logs' },
  { label: '诊断', href: '/diagnostics' },
] as const;

export function RuntimeSectionNav({
  projectId,
  environmentId,
}: {
  projectId: string;
  environmentId?: string | null;
}) {
  const pathname = usePathname();
  const basePath = environmentId
    ? `/projects/${projectId}/environments/${environmentId}`
    : `/projects/${projectId}/environments`;

  return (
    <div className="ui-control-muted rounded-[24px] px-3 py-3">
      <div className="flex flex-wrap gap-2">
        {runtimeNav.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive =
            item.href === ''
              ? pathname === basePath
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-foreground text-background shadow-[0_8px_20px_rgba(55,53,47,0.14)]'
                  : 'ui-control text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
