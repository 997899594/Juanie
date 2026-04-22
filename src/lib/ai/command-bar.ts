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
      kind: 'unsupported';
    };

export interface CommandBarConfig {
  title: string;
  description: string;
  endpoint: string | null;
  taskEndpoint: string | null;
  suggestions: string[];
}

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

  return { kind: 'unsupported' };
}

export function getCommandBarConfig(pathname: string): CommandBarConfig {
  const scope = resolveCommandBarScope(pathname);

  if (scope.kind === 'release') {
    return {
      title: '当前发布',
      description: '快速问这次发布的风险、阻塞和下一步。',
      endpoint: `/api/projects/${scope.projectId}/releases/${scope.releaseId}/copilot`,
      taskEndpoint: `/api/projects/${scope.projectId}/releases/${scope.releaseId}/tasks`,
      suggestions: ['这次发布现在安全吗？', '最关键的阻塞点是什么？', '我下一步该先做什么？'],
    };
  }

  if (scope.kind === 'environment') {
    return {
      title: '当前环境',
      description: '快速问这个环境现在最该看什么、哪里有风险、下一步做什么。',
      endpoint: `/api/projects/${scope.projectId}/environments/${scope.environmentId}/copilot`,
      taskEndpoint: `/api/projects/${scope.projectId}/environments/${scope.environmentId}/tasks`,
      suggestions: [
        '当前环境最该先看什么？',
        '这个环境为什么是现在这个状态？',
        '变量和数据库里最需要关注哪一项？',
      ],
    };
  }

  return {
    title: 'AI Command',
    description: '进入环境页或发布页后，这里才会带着对象上下文工作。',
    endpoint: null,
    taskEndpoint: null,
    suggestions: [],
  };
}
