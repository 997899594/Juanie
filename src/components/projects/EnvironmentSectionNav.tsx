'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const environmentNav = [
  { label: '概览', href: '' },
  { label: '发布', href: '/delivery' },
  { label: '数据', href: '/schema' },
  { label: '变量', href: '/variables' },
  { label: '日志', href: '/logs' },
  { label: '诊断', href: '/diagnostics' },
] as const;

export function EnvironmentSectionNav({
  projectId,
  environmentId,
}: {
  projectId: string;
  environmentId?: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,244,239,0.9))] px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,0.84)_inset,0_10px_26px_rgba(55,53,47,0.05)] lg:hidden">
      <div className="flex flex-wrap gap-2">
        {environmentNav.map((item) => {
          const href = `${environmentId ? `/projects/${projectId}/environments/${environmentId}` : `/projects/${projectId}/environments`}${item.href}`;
          const isActive =
            item.href === ''
              ? pathname ===
                (environmentId
                  ? `/projects/${projectId}/environments/${environmentId}`
                  : `/projects/${projectId}/environments`)
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-foreground text-background shadow-[0_8px_20px_rgba(55,53,47,0.14)]'
                  : 'bg-transparent text-muted-foreground hover:bg-white/85 hover:text-foreground'
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
