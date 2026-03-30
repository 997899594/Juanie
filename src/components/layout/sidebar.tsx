'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  buildProjectNavHref,
  isNavItemActive,
  isProjectNavItemActive,
  mainNav,
  projectNav,
} from './navigation';

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
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 border-r border-border bg-sidebar lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-5 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-sm font-bold text-white">
              J
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Juanie</div>
              <div className="text-xs text-muted-foreground">Release Control</div>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
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
                  <Icon className="h-4 w-4" />
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
                  const href = buildProjectNavHref(projectId, item.href);
                  const isActive = isProjectNavItemActive(pathname, projectId, item.href);
                  const Icon = item.icon;
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
                      <Icon className="h-4 w-4" />
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
