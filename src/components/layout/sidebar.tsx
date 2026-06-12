'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PlatformNavItem, PlatformNavLabel } from '@/components/ui/platform-navigation';
import { useProjectContext } from '@/lib/project-context';
import { BrandLockup } from './brand';
import {
  buildEnvironmentNavHref,
  buildProjectNavHref,
  environmentNav,
  getProjectIdFromPathname,
  isNavItemActive,
  isProjectNavItemActive,
  mainNav,
  projectNav,
} from './navigation';
import { UserMenu } from './user-menu';

export function Sidebar() {
  const pathname = usePathname();
  const project = useProjectContext();
  const [environmentName, setEnvironmentName] = useState('');
  const queryEnvironmentId =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('env') : null;

  const projectId = project?.projectId ?? getProjectIdFromPathname(pathname);
  const environmentIdMatch = pathname.match(/\/projects\/[^/]+\/environments\/([^/]+)/);
  const environmentId = environmentIdMatch?.[1] ?? queryEnvironmentId;
  const isInEnvironment = !!projectId && !!environmentId;
  const projectName = project?.projectName ?? '';

  useEffect(() => {
    if (!projectId || !environmentId) {
      setEnvironmentName('');
      return;
    }

    fetch(`/api/projects/${projectId}/environments/${environmentId}`)
      .then((r) => (r.ok ? r.json() : null))
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
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <PlatformNavItem
                  key={item.href}
                  href={item.href}
                  icon={Icon}
                  label={item.title}
                  active={isActive}
                />
              );
            })}
          </nav>

          {projectId && (
            <div className="mt-6">
              <PlatformNavLabel>当前项目</PlatformNavLabel>
              <nav className="space-y-1">
                {projectNav.map((item) => {
                  const href = buildProjectNavHref(projectId, item.href);
                  const isActive = isProjectNavItemActive(pathname, projectId, item.href);
                  const Icon = item.icon;

                  return (
                    <PlatformNavItem
                      key={item.href}
                      href={href}
                      icon={Icon}
                      label={item.title}
                      active={isActive}
                    />
                  );
                })}
              </nav>
            </div>
          )}

          {isInEnvironment && projectId && environmentId && (
            <div className="mt-6">
              <PlatformNavLabel>{environmentName || projectName || '当前环境'}</PlatformNavLabel>
              <nav className="space-y-1">
                {environmentNav.map((item) => {
                  const href = buildEnvironmentNavHref(projectId, environmentId, item.href);
                  const isActive =
                    item.href === ''
                      ? pathname === `/projects/${projectId}/environments/${environmentId}`
                      : pathname === href || pathname.startsWith(`${href}/`);
                  const Icon = item.icon;

                  return (
                    <PlatformNavItem
                      key={item.href}
                      href={href}
                      icon={Icon}
                      label={item.title}
                      active={isActive}
                    />
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
