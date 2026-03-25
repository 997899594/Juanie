'use client';

import {
  AlertTriangle,
  Box,
  FolderKanban,
  Globe,
  Home,
  Rocket,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  {
    title: '首页',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: '项目',
    href: '/projects',
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    title: '审批',
    href: '/approvals',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  {
    title: '团队',
    href: '/teams',
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: '设置',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

const projectNav: NavItem[] = [
  {
    title: '概览',
    href: '',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: '发布',
    href: '/releases',
    icon: <Rocket className="h-4 w-4" />,
  },
  {
    title: '环境',
    href: '/environments',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    title: '资源',
    href: '/resources',
    icon: <Box className="h-4 w-4" />,
  },
  {
    title: '设置',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [projectName, setProjectName] = useState('');

  const projectIdMatch = pathname.match(/\/projects\/([^/]+)/);
  const projectId = projectIdMatch?.[1];
  const isInProject = !!projectId;

  useEffect(() => {
    if (!projectId) {
      setProjectName('');
      return;
    }
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => setProjectName(data?.name ?? ''))
      .catch(() => {});
  }, [projectId]);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-5 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-sm font-bold text-white">
              J
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Juanie</div>
              <div className="text-xs text-muted-foreground">发布控制台</div>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-black text-white'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>

          {isInProject && (
            <div className="mt-6">
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {projectName || '项目'}
              </div>
              <nav className="space-y-1">
                {projectNav.map((item) => {
                  const href = `/projects/${projectId}${item.href}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-black text-white'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
