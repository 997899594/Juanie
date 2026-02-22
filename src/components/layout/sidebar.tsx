'use client';

import {
  Box,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Globe,
  Home,
  Rocket,
  Settings,
  Users,
  Webhook,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  {
    title: 'Home',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    title: 'Teams',
    href: '/teams',
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

const projectNav: NavItem[] = [
  {
    title: 'Overview',
    href: '',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: 'Deployments',
    href: '/deployments',
    icon: <Rocket className="h-4 w-4" />,
  },
  {
    title: 'Environments',
    href: '/environments',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    title: 'Resources',
    href: '/resources',
    icon: <Box className="h-4 w-4" />,
  },
  {
    title: 'Pipelines',
    href: '/pipelines',
    icon: <Workflow className="h-4 w-4" />,
  },
  {
    title: 'Webhooks',
    href: '/webhooks',
    icon: <Webhook className="h-4 w-4" />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

interface SidebarProps {
  projectName?: string;
  projectId?: string;
}

export function Sidebar({ projectName, projectId }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isInProject = pathname.includes('/projects/') && projectId;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-200',
          collapsed ? 'w-16' : 'w-52'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center px-3">
            {!collapsed && (
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-black text-white text-xs font-bold">
                  J
                </div>
                <span className="font-medium text-sm">Juanie</span>
              </Link>
            )}
            {collapsed && (
              <Link href="/" className="mx-auto">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-black text-white text-xs font-bold">
                  J
                </div>
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <nav className="space-y-0.5 px-2">
              {mainNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground',
                          collapsed && 'justify-center px-2'
                        )}
                      >
                        {item.icon}
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="text-xs">
                        {item.title}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </nav>

            {isInProject && !collapsed && (
              <div className="mt-6 px-2">
                <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {projectName || 'Project'}
                </div>
                <nav className="space-y-0.5">
                  {projectNav.map((item) => {
                    const href = `/projects/${projectId}${item.href}`;
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground'
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

          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
