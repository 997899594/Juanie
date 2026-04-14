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

export const projectNav: NavItem[] = [
  {
    title: '总览',
    href: '',
    icon: Home,
  },
  {
    title: '交付',
    href: '/delivery',
    icon: Rocket,
  },
  {
    title: '数据',
    href: '/schema',
    icon: Database,
  },
  {
    title: '运行',
    href: '/runtime',
    icon: Globe,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function buildProjectNavHref(projectId: string, href: string): string {
  return `/projects/${projectId}${href}`;
}

export function isProjectNavItemActive(pathname: string, projectId: string, href: string): boolean {
  const fullHref = buildProjectNavHref(projectId, href);

  if (href === '') {
    return pathname === fullHref;
  }

  return isNavItemActive(pathname, fullHref);
}
