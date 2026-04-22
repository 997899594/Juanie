'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openAICommandBar } from './ai-command-bar';
import { BrandLockup } from './brand';
import { buildEnvironmentNavHref, environmentNav, isNavItemActive, mainNav } from './navigation';
import { UserMenu } from './user-menu';

export function Sidebar() {
  const pathname = usePathname();
  const [projectName, setProjectName] = useState('');
  const [environmentName, setEnvironmentName] = useState('');
  const queryEnvironmentId =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('env') : null;

  const projectIdMatch = pathname.match(/\/projects\/([^/]+)/);
  const projectId = projectIdMatch?.[1];
  const environmentIdMatch = pathname.match(/\/projects\/[^/]+\/environments\/([^/]+)/);
  const environmentId = environmentIdMatch?.[1] ?? queryEnvironmentId;
  const isInEnvironment = !!projectId && !!environmentId;

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

  useEffect(() => {
    if (!projectId || !environmentId) {
      setEnvironmentName('');
      return;
    }

    fetch(`/api/projects/${projectId}/environments/${environmentId}`)
      .then((r) => r.json())
      .then((data) => setEnvironmentName(data?.name ?? ''))
      .catch(() => {});
  }, [environmentId, projectId]);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 p-4 lg:block">
      <div className="glass flex h-full flex-col overflow-hidden rounded-[28px] shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_16px_36px_rgba(55,53,47,0.045)]">
        <div className="console-divider-bottom px-5 py-5">
          <BrandLockup
            href="/"
            size={44}
            subtitle="Release Control"
            subtitleClassName="tracking-[0.12em] uppercase"
            priority
          />
          <Button
            variant="ghost"
            className="mt-4 h-11 w-full justify-between rounded-[18px] bg-[rgba(15,23,42,0.045)] px-3 text-sm text-[rgba(15,23,42,0.76)] shadow-none hover:bg-[rgba(15,23,42,0.08)]"
            onClick={() => openAICommandBar()}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI
            </span>
            <span className="text-xs text-[rgba(15,23,42,0.34)]">⌘K</span>
          </Button>
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

          {isInEnvironment && projectId && environmentId && (
            <div className="mt-6">
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {environmentName || projectName || '环境'}
              </div>
              <nav className="space-y-1">
                {environmentNav.map((item) => {
                  const href = buildEnvironmentNavHref(projectId, environmentId, item.href);
                  const isActive =
                    item.href === ''
                      ? pathname === `/projects/${projectId}/environments/${environmentId}`
                      : pathname === href || pathname.startsWith(`${href}/`);
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

        <div className="console-divider-top p-3">
          <UserMenu variant="sidebar" />
        </div>
      </div>
    </aside>
  );
}
