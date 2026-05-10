import {
  Bell,
  Database,
  FolderKanban,
  Globe,
  Home,
  type LucideIcon,
  Rocket,
  Settings,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const mainNav: NavItem[] = [
  {
    title: '项目',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    title: '待处理',
    href: '/inbox',
    icon: Bell,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
];

export const mobileMainNav = mainNav;

export const projectNav: NavItem[] = [
  {
    title: '总览',
    href: '',
    icon: Home,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
] as const;

export const environmentNav: NavItem[] = [
  {
    title: '发布历史',
    href: '/delivery',
    icon: Rocket,
  },
  {
    title: '环境变量',
    href: '/variables',
    icon: Database,
  },
  {
    title: '日志',
    href: '/logs',
    icon: Globe,
  },
] as const;

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function buildEnvironmentNavHref(
  projectId: string,
  environmentId: string,
  href: string
): string {
  return `/projects/${projectId}/environments/${environmentId}${href}`;
}

export function buildProjectNavHref(projectId: string, href: string): string {
  return `/projects/${projectId}${href}`;
}

export function isProjectNavItemActive(pathname: string, projectId: string, href: string): boolean {
  const baseHref = `/projects/${projectId}`;
  const targetHref = buildProjectNavHref(projectId, href);

  if (href === '') {
    return pathname === baseHref || pathname === `${baseHref}/initializing`;
  }

  return pathname === targetHref || pathname.startsWith(`${targetHref}/`);
}

export function getProjectIdFromPathname(pathname: string): string | null {
  const projectId = pathname.match(/\/projects\/([^/]+)/)?.[1];
  return projectId && uuidPattern.test(projectId) ? projectId : null;
}
