'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { useProjectContext } from '@/lib/project-context';
import { UserMenu } from './user-menu';

interface BreadcrumbItem {
  title: string;
  href?: string;
}

export function Header() {
  const pathname = usePathname();
  const project = useProjectContext();
  const breadcrumbs = generateBreadcrumbs(pathname, project ?? undefined);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <nav className="flex items-center text-sm">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={item.title}>
              {index > 0 && <ChevronRight className="mx-1.5 h-4 w-4 text-muted-foreground/50" />}
              {index < breadcrumbs.length - 1 && item.href ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="font-semibold">{item.title}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        <UserMenu />
      </div>
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
    approvals: '审批',
    teams: '团队',
    settings: '设置',
    deployments: '发布',
    releases: '发布',
    environments: '环境',
    resources: '资源',
    members: '成员',
    new: '新建',
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
