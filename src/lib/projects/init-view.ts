import type { PlatformSignalChipLike } from '@/components/ui/platform-signals';
import type { InitStepStatus } from '@/lib/db/schema';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';

export interface ProjectInitStepLike {
  id: string;
  step: string;
  status: InitStepStatus;
  message: string | null;
  progress: number | null;
  errorCode?: string | null;
  error: string | null;
}

export interface ProjectInitStepCard {
  id: string;
  step: string;
  label: string;
  status: InitStepStatus;
  message: string | null;
  progress: number;
  errorCode?: string | null;
  error: string | null;
  summary: string;
}

export interface ProjectInitOverview {
  status: 'initializing' | 'active' | 'failed';
  statusLabel: string;
  statusTone: 'info' | 'success' | 'error';
  overallProgress: number;
  completedSteps: number;
  totalSteps: number;
  primarySummary: string;
  nextActionLabel: string;
  chips: PlatformSignalChipLike[];
  platformSignals: ReturnType<typeof buildPlatformSignalSnapshot>;
  recoveryAction: {
    kind: 'retry' | 'link' | 'wait';
    label: string;
    href?: string;
  } | null;
  steps: ProjectInitStepCard[];
}

interface ProjectInitIssueSnapshot {
  code:
    | 'repository_validation_failed'
    | 'repository_creation_failed'
    | 'template_push_failed'
    | 'ci_config_push_failed'
    | 'release_trigger_failed'
    | 'namespace_setup_failed'
    | 'service_deploy_failed'
    | 'database_provision_failed'
    | 'dns_config_failed'
    | 'init_failed';
  label: string;
  summary: string;
  nextActionLabel: string | null;
}

export const PROJECT_INIT_STEP_LABELS: Record<string, string> = {
  validate_repository: '验证仓库',
  create_repository: '创建仓库',
  push_template: '推送模板文件',
  push_cicd_config: '注入 Juanie 配置',
  configure_release_trigger: '配置发布触发',
  setup_namespace: '创建命名空间',
  deploy_services: '部署服务',
  provision_databases: '创建数据库',
  configure_dns: '配置域名',
  trigger_initial_builds: '触发首发构建',
};

export const PROJECT_INIT_STEP_WEIGHTS: Record<string, number> = {
  validate_repository: 10,
  create_repository: 10,
  push_template: 15,
  push_cicd_config: 15,
  configure_release_trigger: 10,
  setup_namespace: 15,
  deploy_services: 30,
  provision_databases: 20,
  configure_dns: 10,
  trigger_initial_builds: 10,
};

function buildStepSummary(step: ProjectInitStepLike): string {
  if (step.error) {
    return step.error;
  }

  if (step.message) {
    return step.message;
  }

  switch (step.status) {
    case 'completed':
      return '已完成';
    case 'running':
      return '正在执行';
    case 'failed':
      return '执行失败';
    case 'skipped':
      return '已跳过';
    default:
      return '等待执行';
  }
}

function buildProjectInitIssue(
  step: ProjectInitStepLike | undefined
): ProjectInitIssueSnapshot | null {
  if (!step) {
    return null;
  }

  const error = step.error || buildStepSummary(step);

  switch (step.errorCode) {
    case 'repository_missing':
      return {
        code: 'repository_validation_failed',
        label: '仓库未绑定',
        summary: error || '项目还没有绑定可用仓库',
        nextActionLabel: '检查仓库绑定后重试',
      };
    case 'repository_access_denied':
      return {
        code: 'repository_validation_failed',
        label: '仓库访问失败',
        summary: error || '平台无法访问当前仓库',
        nextActionLabel: '检查仓库读取授权',
      };
    case 'repository_create_denied':
      return {
        code: 'repository_creation_failed',
        label: '建仓权限不足',
        summary: error || '当前授权不足以创建仓库',
        nextActionLabel: '检查建仓授权',
      };
    case 'repository_create_failed':
      return {
        code: 'repository_creation_failed',
        label: '仓库创建失败',
        summary: error || '平台无法创建目标仓库',
        nextActionLabel: '检查仓库提供方状态后重试',
      };
    case 'template_push_failed':
      return {
        code: 'template_push_failed',
        label: '模板推送失败',
        summary: error || '平台无法推送模板文件',
        nextActionLabel: '检查仓库写入权限',
      };
    case 'cicd_config_push_failed':
      return {
        code: 'ci_config_push_failed',
        label: '平台配置注入失败',
        summary: error || '平台无法注入 Juanie 配置和 CI',
        nextActionLabel: '检查仓库写入与工作流权限',
      };
    case 'release_trigger_failed':
      return {
        code: 'release_trigger_failed',
        label: '发布触发配置失败',
        summary: error || '平台无法配置发布触发链路',
        nextActionLabel: '检查仓库与发布触发配置',
      };
    case 'k8s_namespace_failed':
      return {
        code: 'namespace_setup_failed',
        label: '命名空间创建失败',
        summary: error || '平台无法创建项目命名空间',
        nextActionLabel: '检查 Kubernetes 权限',
      };
    case 'database_provision_failed':
      return {
        code: 'database_provision_failed',
        label: '数据库创建失败',
        summary: error || '平台无法完成数据库创建',
        nextActionLabel: '检查数据库资源和平台权限',
      };
    case 'service_deploy_failed':
      return {
        code: 'service_deploy_failed',
        label: '服务部署失败',
        summary: error || '平台无法完成初始服务部署',
        nextActionLabel: '检查部署日志',
      };
    case 'dns_config_failed':
      return {
        code: 'dns_config_failed',
        label: '域名配置失败',
        summary: error || '平台无法完成域名配置',
        nextActionLabel: '检查域名和网关配置',
      };
    case 'init_enqueue_failed':
      return {
        code: 'init_failed',
        label: '初始化调度失败',
        summary: error || '平台未能成功创建初始化任务',
        nextActionLabel: '稍后重试初始化',
      };
    case 'initial_build_trigger_failed':
      return {
        code: 'init_failed',
        label: '首发构建触发失败',
        summary: error || '平台无法触发初始化首发构建',
        nextActionLabel: '检查远端分支、CI workflow 与触发权限',
      };
  }

  switch (step.step) {
    case 'validate_repository':
      return {
        code: 'repository_validation_failed',
        label: '仓库访问失败',
        summary: error || '平台无法访问当前仓库',
        nextActionLabel: '检查仓库授权',
      };
    case 'create_repository':
      return {
        code: 'repository_creation_failed',
        label: '仓库创建失败',
        summary: error || '平台无法创建目标仓库',
        nextActionLabel: '检查建仓授权',
      };
    case 'push_template':
      return {
        code: 'template_push_failed',
        label: '模板推送失败',
        summary: error || '平台无法推送模板文件',
        nextActionLabel: '检查仓库写入权限',
      };
    case 'push_cicd_config':
      return {
        code: 'ci_config_push_failed',
        label: '平台配置注入失败',
        summary: error || '平台无法注入 Juanie 配置和 CI',
        nextActionLabel: '检查仓库写入与工作流权限',
      };
    case 'configure_release_trigger':
      return {
        code: 'release_trigger_failed',
        label: '发布触发配置失败',
        summary: error || '平台无法配置发布触发链路',
        nextActionLabel: '检查仓库和发布触发配置',
      };
    case 'setup_namespace':
      return {
        code: 'namespace_setup_failed',
        label: '命名空间创建失败',
        summary: error || '平台无法创建项目命名空间',
        nextActionLabel: '检查 Kubernetes 权限',
      };
    case 'deploy_services':
      return {
        code: 'service_deploy_failed',
        label: '服务部署失败',
        summary: error || '平台无法完成初始服务部署',
        nextActionLabel: '检查部署日志',
      };
    case 'provision_databases':
      return {
        code: 'database_provision_failed',
        label: '数据库创建失败',
        summary: error || '平台无法完成数据库创建',
        nextActionLabel: '检查数据库资源和平台权限',
      };
    case 'configure_dns':
      return {
        code: 'dns_config_failed',
        label: '域名配置失败',
        summary: error || '平台无法完成域名配置',
        nextActionLabel: '检查域名和网关配置',
      };
    case 'trigger_initial_builds':
      return {
        code: 'init_failed',
        label: '首发构建触发失败',
        summary: error || '平台无法触发初始化首发构建',
        nextActionLabel: '检查远端分支、CI workflow 与触发权限',
      };
    default:
      return {
        code: 'init_failed',
        label: '初始化失败',
        summary: error || '平台初始化流程执行失败',
        nextActionLabel: '检查失败步骤后重试',
      };
  }
}

export function calculateProjectInitProgress(steps: ProjectInitStepLike[]): number {
  let completedWeight = 0;
  let totalWeight = 0;

  for (const step of steps) {
    const weight = PROJECT_INIT_STEP_WEIGHTS[step.step] || 10;
    totalWeight += weight;

    if (step.status === 'completed') {
      completedWeight += weight;
    } else if (step.status === 'running') {
      completedWeight += weight * ((step.progress ?? 0) / 100);
    }
  }

  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
}

export function resolveProjectInitStatus(
  steps: ProjectInitStepLike[]
): 'initializing' | 'active' | 'failed' {
  const allComplete = steps.length > 0 && steps.every((step) => step.status === 'completed');
  const anyFailed = steps.some((step) => step.status === 'failed');

  if (anyFailed) {
    return 'failed';
  }

  if (allComplete) {
    return 'active';
  }

  return 'initializing';
}

function buildProjectInitSignals(input: {
  status: 'initializing' | 'active' | 'failed';
  steps: ProjectInitStepLike[];
}): PlatformSignalChipLike[] {
  const failedStep = input.steps.find((step) => step.status === 'failed');
  const runningStep = input.steps.find((step) => step.status === 'running');

  const chips: PlatformSignalChipLike[] = [];

  chips.push({
    key: `status:${input.status}`,
    label:
      input.status === 'active'
        ? '初始化完成'
        : input.status === 'failed'
          ? '初始化失败'
          : '初始化中',
    tone: input.status === 'failed' ? 'danger' : 'neutral',
  });

  if (failedStep) {
    chips.push({
      key: `failed-step:${failedStep.step}`,
      label: `${PROJECT_INIT_STEP_LABELS[failedStep.step] || failedStep.step}失败`,
      tone: 'danger',
    });
  } else if (runningStep) {
    chips.push({
      key: `running-step:${runningStep.step}`,
      label: `当前：${PROJECT_INIT_STEP_LABELS[runningStep.step] || runningStep.step}`,
      tone: 'neutral',
    });
  }

  return chips;
}

function buildProjectInitRecoveryAction(
  step: ProjectInitStepLike | undefined
): ProjectInitOverview['recoveryAction'] {
  if (!step) {
    return null;
  }

  if (step.message?.includes('自动重试')) {
    return {
      kind: 'wait',
      label: '等待平台自动重试',
    };
  }

  switch (step.errorCode) {
    case 'repository_access_denied':
    case 'repository_create_denied':
    case 'cicd_config_push_failed':
    case 'release_trigger_failed':
      return {
        kind: 'link',
        label: '打开集成设置',
        href: '/settings/integrations',
      };
    case 'repository_missing':
      return {
        kind: 'link',
        label: '返回创建页',
        href: '/projects/new',
      };
    default:
      return {
        kind: 'retry',
        label: '重新执行初始化',
      };
  }
}

export function buildProjectInitOverview(steps: ProjectInitStepLike[]): ProjectInitOverview {
  const status = resolveProjectInitStatus(steps);
  const failedStep = steps.find((step) => step.status === 'failed');
  const runningStep = steps.find((step) => step.status === 'running');
  const completedSteps = steps.filter((step) => step.status === 'completed').length;
  const overallProgress = calculateProjectInitProgress(steps);
  const issue = buildProjectInitIssue(failedStep);
  const recoveryAction = buildProjectInitRecoveryAction(failedStep);
  const platformSignals = buildPlatformSignalSnapshot({
    issue: issue
      ? {
          code: issue.code,
          label: issue.label,
          summary: issue.summary,
          nextActionLabel: issue.nextActionLabel,
        }
      : null,
  });

  const primarySummary =
    platformSignals.primarySummary ??
    (status === 'active'
      ? '项目初始化已完成，平台正在切换到项目主页。'
      : status === 'failed'
        ? failedStep?.error ||
          `${PROJECT_INIT_STEP_LABELS[failedStep?.step || ''] || '初始化步骤'}执行失败`
        : runningStep
          ? `${PROJECT_INIT_STEP_LABELS[runningStep.step] || runningStep.step}正在执行`
          : '平台正在准备项目基础设施和发布配置');

  const nextActionLabel =
    platformSignals.nextActionLabel ??
    (status === 'active'
      ? '进入项目'
      : status === 'failed'
        ? '处理失败步骤后重试'
        : runningStep
          ? `等待 ${PROJECT_INIT_STEP_LABELS[runningStep.step] || runningStep.step}`
          : '等待下一步启动');

  const chips =
    platformSignals.chips.length > 0
      ? platformSignals.chips
      : buildProjectInitSignals({ status, steps });

  return {
    status,
    statusLabel: status === 'active' ? '已就绪' : status === 'failed' ? '失败' : '初始化中',
    statusTone: status === 'active' ? 'success' : status === 'failed' ? 'error' : 'info',
    overallProgress,
    completedSteps,
    totalSteps: steps.length,
    primarySummary,
    nextActionLabel,
    chips,
    platformSignals: {
      ...platformSignals,
      chips,
      primarySummary,
      nextActionLabel,
    },
    recoveryAction,
    steps: steps.map((step) => ({
      id: step.id,
      step: step.step,
      label: PROJECT_INIT_STEP_LABELS[step.step] || step.step,
      status: step.status,
      message: step.message,
      progress: step.progress ?? 0,
      errorCode: step.errorCode,
      error: step.error,
      summary: buildStepSummary(step),
    })),
  };
}
