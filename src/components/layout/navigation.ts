import {
  AlertTriangle,
  Database,
  FolderKanban,
  Globe,
  Home,
  type LucideIcon,
  Rocket,
  ScrollText,
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
    title: '首页',
    href: '/',
    icon: Home,
  },
  {
    title: '项目',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    title: '审批',
    href: '/approvals',
    icon: AlertTriangle,
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
    title: '概览',
    href: '',
    icon: Home,
  },
  {
    title: '环境',
    href: '/environments',
    icon: Globe,
  },
  {
    title: 'Schema',
    href: '/schema',
    icon: Database,
  },
  {
    title: '发布',
    href: '/releases',
    icon: Rocket,
  },
  {
    title: '日志',
    href: '/logs',
    icon: ScrollText,
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
