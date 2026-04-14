'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const runtimeNav = [
  { label: '环境', href: '' },
  { label: '变量', href: '/variables' },
  { label: '日志', href: '/logs' },
  { label: '诊断', href: '/diagnostics' },
] as const;

export function RuntimeSectionNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const activeItem =
    runtimeNav.find((item) => {
      const href = `/projects/${projectId}/runtime${item.href}`;
      return item.href === ''
        ? pathname === `/projects/${projectId}/runtime`
        : pathname === href || pathname.startsWith(`${href}/`);
    }) ?? runtimeNav[0];

  return (
    <div className="space-y-3">
      <div className="console-surface rounded-[20px] px-4 py-3 text-sm text-muted-foreground">
        当前：<span className="font-medium text-foreground">{activeItem.label}</span>
      </div>
      <div className="console-panel px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {runtimeNav.map((item) => {
            const href = `/projects/${projectId}/runtime${item.href}`;
            const isActive =
              item.href === ''
                ? pathname === `/projects/${projectId}/runtime`
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-black bg-black text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
