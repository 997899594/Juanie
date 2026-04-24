import { getRuntimeStatusDecoration } from '@/lib/runtime/status-presentation';

interface ProjectRuntimeEnvironmentLike {
  name: string;
  isPreview?: boolean | null;
  deliveryMode?: 'direct' | 'promote_only' | null;
  previewBuildStatus?: string | null;
}

export interface ProjectRuntimeStatusSnapshot {
  status: string | null;
  statusLabel: string;
  color: 'success' | 'warning' | 'error' | 'neutral';
  summary: string | null;
  nextActionLabel: string | null;
  bootstrapEnvironmentName: string | null;
  bootstrapSourceBuildStatus: 'building' | 'failed' | null;
}

function pickBootstrapSourceBuildEnvironment(
  environments: ProjectRuntimeEnvironmentLike[] | null | undefined
): ProjectRuntimeEnvironmentLike | null {
  if (!environments?.length) {
    return null;
  }

  const bootstrapCandidates = environments.filter(
    (environment) =>
      !environment.isPreview &&
      environment.deliveryMode !== 'promote_only' &&
      (environment.previewBuildStatus === 'building' || environment.previewBuildStatus === 'failed')
  );

  return (
    bootstrapCandidates.find((environment) => environment.previewBuildStatus === 'failed') ??
    bootstrapCandidates.find((environment) => environment.previewBuildStatus === 'building') ??
    null
  );
}

export function resolveProjectRuntimeStatus(input: {
  status?: string | null;
  environments?: ProjectRuntimeEnvironmentLike[] | null;
}): ProjectRuntimeStatusSnapshot {
  const baseStatus = input.status ?? null;

  if (baseStatus === 'active') {
    const bootstrapEnvironment = pickBootstrapSourceBuildEnvironment(input.environments);

    if (bootstrapEnvironment?.previewBuildStatus === 'failed') {
      return {
        status: 'failed',
        statusLabel: '首发构建失败',
        color: 'error',
        summary: `${bootstrapEnvironment.name} 的首发构建没有成功进入发布链路`,
        nextActionLabel: '进入项目检查仓库流水线与环境状态',
        bootstrapEnvironmentName: bootstrapEnvironment.name,
        bootstrapSourceBuildStatus: 'failed',
      };
    }

    if (bootstrapEnvironment?.previewBuildStatus === 'building') {
      return {
        status: 'initializing',
        statusLabel: '首发构建中',
        color: 'warning',
        summary: `${bootstrapEnvironment.name} 正在执行首发构建，完成后项目才算真正可用`,
        nextActionLabel: '等待仓库流水线完成并回调 Juanie',
        bootstrapEnvironmentName: bootstrapEnvironment.name,
        bootstrapSourceBuildStatus: 'building',
      };
    }
  }

  const decoration = getRuntimeStatusDecoration(baseStatus);

  return {
    status: baseStatus,
    statusLabel: decoration.label,
    color: decoration.color,
    summary: null,
    nextActionLabel: null,
    bootstrapEnvironmentName: null,
    bootstrapSourceBuildStatus: null,
  };
}
