import {
  Bell,
  Database,
  FolderKanban,
  Globe,
  Home,
  type LucideIcon,
  Rocket,
  Settings,
  Users,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const mainNav: NavItem[] = [
  {
    title: '指挥台',
    href: '/',
    icon: Home,
  },
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
    title: '团队',
    href: '/teams',
    icon: Users,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
];

export const mobileMainNav = [mainNav[0], mainNav[1], mainNav[2], mainNav[4]].filter(
  Boolean
) as NavItem[];

export const projectNav: NavItem[] = [
  {
    title: '总览',
    href: '',
    icon: Home,
  },
  {
    title: '环境',
    href: '/environments',
    icon: Globe,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
] as const;

export const environmentNav: NavItem[] = [
  {
    title: '概览',
    href: '',
    icon: Home,
  },
  {
    title: '发布',
    href: '/delivery',
    icon: Rocket,
  },
  {
    title: '数据',
    href: '/schema',
    icon: Database,
  },
  {
    title: '变量',
    href: '/variables',
    icon: Settings,
  },
  {
    title: '日志',
    href: '/logs',
    icon: Globe,
  },
  {
    title: '诊断',
    href: '/diagnostics',
    icon: Rocket,
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
