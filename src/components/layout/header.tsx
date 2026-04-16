'use client';

import { ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useProjectContext } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { BrandLockup } from './brand';
import {
  buildEnvironmentNavHref,
  buildProjectNavHref,
  environmentNav,
  isNavItemActive,
  isProjectNavItemActive,
  mainNav,
  projectNav,
} from './navigation';
import { UserMenu } from './user-menu';

interface BreadcrumbItem {
  title: string;
  href?: string;
}

export function Header() {
  const pathname = usePathname();
  const project = useProjectContext();
  const breadcrumbs = generateBreadcrumbs(pathname, project ?? undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.title ?? '首页';
  const projectId = project?.projectId ?? null;
  const environmentIdMatch = pathname.match(/\/projects\/[^/]+\/environments\/([^/]+)/);
  const environmentId = environmentIdMatch?.[1] ?? null;
  const mobileProjectTabs = useMemo(() => {
    if (!projectId) {
      return [];
    }

    if (environmentId) {
      return environmentNav.map((item) => ({
        ...item,
        href: buildEnvironmentNavHref(projectId, environmentId, item.href),
      }));
    }

    return projectNav.map((item) => ({
      ...item,
      href: buildProjectNavHref(projectId, item.href),
    }));
  }, [environmentId, projectId]);
  const isMobileTabActive = (href: string) => {
    if (!projectId) {
      return false;
    }

    if (environmentId) {
      if (href.includes('/schema?env=')) {
        return pathname === `/projects/${projectId}/schema`;
      }

      const baseHref = `/projects/${projectId}/environments/${environmentId}`;
      if (href === baseHref) {
        return pathname === baseHref;
      }

      return pathname === href || pathname.startsWith(`${href}/`);
    }

    return isProjectNavItemActive(pathname, projectId, href.replace(`/projects/${projectId}`, ''));
  };

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 md:px-6 lg:px-6">
      <div className="glass hidden items-center justify-between rounded-[20px] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_10px_30px_rgba(55,53,47,0.035)] lg:flex">
        <nav className="flex min-w-0 items-center text-sm">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={item.title}>
              {index > 0 && <ChevronRight className="mx-1.5 h-4 w-4 text-muted-foreground/50" />}
              {index < breadcrumbs.length - 1 && item.href ? (
                <Link
                  href={item.href}
                  className="transition-colors text-muted-foreground hover:text-foreground"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="truncate font-semibold">{item.title}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        <UserMenu />
      </div>

      <div className="lg:hidden">
        <div className="glass flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_10px_30px_rgba(55,53,47,0.035)]">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl bg-card/80"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              {project ? (
                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {project.projectName}
                </div>
              ) : (
                <BrandLockup
                  href="/"
                  size={24}
                  className="gap-2"
                  markClassName="rounded-xl"
                  nameClassName="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                />
              )}
              <div className="truncate text-sm font-semibold">{currentTitle}</div>
            </div>
          </div>

          <UserMenu />
        </div>

        {mobileProjectTabs.length > 0 && (
          <div className="overflow-x-auto px-1 pb-2.5 pt-2.5">
            <nav className="flex min-w-max items-center gap-2">
              {mobileProjectTabs.map((item) => {
                const Icon = item.icon;
                const isActive = isMobileTabActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.03)] transition-colors',
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'bg-card/90 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="left-0 top-0 h-[100dvh] max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:left-0 sm:top-0 sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none">
          <DialogTitle className="sr-only">移动端导航</DialogTitle>
          <div className="flex h-full flex-col bg-background">
            <div className="console-divider-bottom px-5 py-5">
              <BrandLockup
                href="/"
                size={36}
                className="gap-2.5"
                markClassName="rounded-xl"
                nameClassName="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              />
              <div className="mt-2 text-2xl font-semibold tracking-tight">导航</div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  全局
                </div>
                <nav className="space-y-2">
                  {mainNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = isNavItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_20px_rgba(55,53,47,0.028)] transition-colors',
                          isActive
                            ? 'bg-secondary text-foreground'
                            : 'bg-card text-foreground hover:bg-secondary'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {mobileProjectTabs.length > 0 && (
                <div className="mt-6">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {environmentId ? '当前环境' : (project?.projectName ?? '项目')}
                  </div>
                  <nav className="space-y-2">
                    {mobileProjectTabs.map((item) => {
                      const Icon = item.icon;
                      const isActive = isMobileTabActive(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_20px_rgba(55,53,47,0.028)] transition-colors',
                            isActive
                              ? 'bg-secondary text-foreground'
                              : 'bg-card text-foreground hover:bg-secondary'
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
        </DialogContent>
      </Dialog>
    </header>
  );
}

function generateBreadcrumbs(
  pathname: string,
  project?: { projectId: string; projectName: string }
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ title: '首页' }];
  }

  const pathMap: Record<string, string> = {
    projects: '项目',
    inbox: '行动',
    approvals: '审批',
    teams: '团队',
    settings: '设置',
    delivery: '交付',
    deployments: '部署执行',
    releases: '发布',
    environments: '环境',
    logs: '日志',
    resources: '资源浏览',
    members: '成员',
    new: '新建',
    schema: '数据',
    runtime: '环境',
  };

  const breadcrumbs: BreadcrumbItem[] = [{ title: '首页', href: '/' }];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    // Replace project UUID with the actual project name
    const isProjectId = project && segment === project.projectId;
    const isReleaseId =
      segments[index - 1] === 'releases' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment);
    const title = isProjectId
      ? project.projectName
      : isReleaseId
        ? '详情'
        : (pathMap[segment] ?? segment);

    if (index === segments.length - 1) {
      breadcrumbs.push({ title });
    } else {
      breadcrumbs.push({ title, href: currentPath });
    }
  });

  return breadcrumbs;
}
