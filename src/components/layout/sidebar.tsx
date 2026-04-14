'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BrandLockup } from './brand';
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
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 p-4 lg:block">
      <div className="glass flex h-full flex-col overflow-hidden rounded-[28px] border border-border/60 shadow-lg">
        <div className="border-b border-border/70 px-5 py-5">
          <BrandLockup
            href="/"
            size={44}
            subtitle="Release Control"
            subtitleClassName="tracking-[0.12em] uppercase"
            priority
          />
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
                    'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
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
                        'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
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
