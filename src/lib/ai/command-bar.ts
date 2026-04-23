export type CommandBarScope =
  | {
      kind: 'environment';
      projectId: string;
      environmentId: string;
    }
  | {
      kind: 'release';
      projectId: string;
      environmentId: string;
      releaseId: string;
    }
  | {
      kind: 'none';
    };

export interface CommandBarRoute {
  label: string;
  href: string;
}

export interface CommandBarConfig {
  kind: 'chat' | 'resolver';
  title: string;
  endpoint: string | null;
  taskEndpoint: string | null;
  suggestions: string[];
  routes: CommandBarRoute[];
}

const resolverRoutes: CommandBarRoute[] = [
  { label: '项目', href: '/projects' },
  { label: '待办', href: '/inbox' },
  { label: '团队', href: '/teams' },
  { label: '设置', href: '/settings' },
];

export function resolveCommandBarScope(pathname: string): CommandBarScope {
  const releaseMatch = pathname.match(
    /^\/projects\/([^/]+)\/environments\/([^/]+)\/delivery\/([^/]+)(?:\/|$)/
  );
  if (releaseMatch) {
    return {
      kind: 'release',
      projectId: releaseMatch[1],
      environmentId: releaseMatch[2],
      releaseId: releaseMatch[3],
    };
  }

  const environmentMatch = pathname.match(/^\/projects\/([^/]+)\/environments\/([^/]+)(?:\/|$)/);
  if (environmentMatch) {
    return {
      kind: 'environment',
      projectId: environmentMatch[1],
      environmentId: environmentMatch[2],
    };
  }

  return { kind: 'none' };
}

export function getCommandBarConfig(pathname: string): CommandBarConfig {
  const scope = resolveCommandBarScope(pathname);

  if (scope.kind === 'release') {
    return {
      kind: 'chat',
      title: '当前发布',
      endpoint: `/api/projects/${scope.projectId}/releases/${scope.releaseId}/copilot`,
      taskEndpoint: `/api/projects/${scope.projectId}/releases/${scope.releaseId}/tasks`,
      suggestions: ['这次发布现在安全吗？', '最关键的阻塞点是什么？', '我下一步该先做什么？'],
      routes: [],
    };
  }

  if (scope.kind === 'environment') {
    return {
      kind: 'chat',
      title: '当前环境',
      endpoint: `/api/projects/${scope.projectId}/environments/${scope.environmentId}/copilot`,
      taskEndpoint: `/api/projects/${scope.projectId}/environments/${scope.environmentId}/tasks`,
      suggestions: [
        '当前环境最该先看什么？',
        '这个环境为什么是现在这个状态？',
        '变量和数据库里最需要关注哪一项？',
      ],
      routes: [],
    };
  }

  return {
    kind: 'resolver',
    title: '选择范围',
    endpoint: null,
    taskEndpoint: null,
    suggestions: [],
    routes: resolverRoutes,
  };
}
