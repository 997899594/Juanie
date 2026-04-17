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
    title: '行动',
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
  if (href === '/delivery') {
    return `/projects/${projectId}/delivery?env=${environmentId}`;
  }

  if (href === '/schema') {
    return `/projects/${projectId}/schema?env=${environmentId}`;
  }

  return `/projects/${projectId}/environments/${environmentId}${href}`;
}
