'use client';

import { Database, Eye, type LucideIcon, Settings, Sparkles, Waves } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ProjectWorkflowNavProps {
  projectId: string;
}

interface WorkflowItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string, projectId: string) => boolean;
}

const workflowItems: WorkflowItem[] = [
  {
    label: '总览',
    shortLabel: '状态',
    href: '',
    icon: Eye,
    match: (pathname, projectId) => pathname === `/projects/${projectId}`,
  },
  {
    label: '交付',
    shortLabel: '发布',
    href: '/delivery',
    icon: Sparkles,
    match: (pathname, projectId) => pathname.startsWith(`/projects/${projectId}/delivery`),
  },
  {
    label: '运行',
    shortLabel: '排查',
    href: '/runtime',
    icon: Waves,
    match: (pathname, projectId) => pathname.startsWith(`/projects/${projectId}/runtime`),
  },
  {
    label: '数据',
    shortLabel: '迁移',
    href: '/schema',
    icon: Database,
    match: (pathname, projectId) => pathname.startsWith(`/projects/${projectId}/schema`),
  },
  {
    label: '设置',
    shortLabel: '规则',
    href: '/settings',
    icon: Settings,
    match: (pathname, projectId) => pathname.startsWith(`/projects/${projectId}/settings`),
  },
];

export function ProjectWorkflowNav({ projectId }: ProjectWorkflowNavProps) {
  const pathname = usePathname();

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      {workflowItems.map((item) => {
        const href = `/projects/${projectId}${item.href}`;
        const isActive = item.match(pathname, projectId);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              'console-surface flex min-h-16 items-center gap-3 rounded-[18px] px-3.5 py-3 transition-all',
              isActive
                ? 'border-border bg-secondary text-foreground'
                : 'hover:bg-secondary/70 hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                isActive ? 'bg-background text-foreground' : 'bg-background/80 text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div
                className={cn(
                  'text-sm font-semibold',
                  isActive ? 'text-foreground' : 'text-foreground'
                )}
              >
                {item.label}
              </div>
              <div
                className={cn(
                  'mt-1 text-[11px] uppercase tracking-[0.14em]',
                  isActive ? 'text-muted-foreground' : 'text-muted-foreground'
                )}
              >
                {isActive ? '当前' : item.shortLabel}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
