'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { UserMenu } from './user-menu';

interface BreadcrumbItem {
  title: string;
  href?: string;
}

export function Header() {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 bg-background border-b">
      <nav className="flex items-center text-sm">
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.title}>
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50 mx-1.5" />}
            {index < breadcrumbs.length - 1 && item.href ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.title}
              </Link>
            ) : (
              <span className="font-medium">{item.title}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <UserMenu />
    </header>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ title: 'Home' }];
  }

  const pathMap: Record<string, string> = {
    projects: 'Projects',
    teams: 'Teams',
    settings: 'Settings',
    deployments: 'Deployments',
    environments: 'Environments',
    resources: 'Resources',
    pipelines: 'Pipelines',
    webhooks: 'Webhooks',
    members: 'Members',
    new: 'New',
  };

  const breadcrumbs: BreadcrumbItem[] = [{ title: 'Home', href: '/' }];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const title = pathMap[segment] || segment;

    if (index === segments.length - 1) {
      breadcrumbs.push({ title });
    } else {
      breadcrumbs.push({ title, href: currentPath });
    }
  });

  return breadcrumbs;
}
