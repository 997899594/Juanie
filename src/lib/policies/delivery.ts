import type { TeamRole } from '@/lib/db/schema';

interface EnvironmentPolicyLike {
  isProduction?: boolean | null;
  isPreview?: boolean | null;
}

interface MigrationPolicyLike {
  compatibility?: string | null;
  approvalPolicy?: string | null;
}

interface ReleasePolicyLike {
  environment: EnvironmentPolicyLike;
  migrationRuns: Array<{
    specification?: MigrationPolicyLike | null;
  }>;
}

export interface MigrationPolicyDecision {
  warnings: string[];
  requiresApproval: boolean;
  approvalReason: string | null;
}

export interface ReleasePolicySnapshot {
  level: 'normal' | 'protected' | 'approval_required';
  reasons: string[];
  summary: string | null;
  requiresApproval: boolean;
}

export interface EnvironmentPolicySnapshot {
  level: 'normal' | 'protected' | 'preview';
  reasons: string[];
  summary: string | null;
}

function isProductionEnvironment(environment: EnvironmentPolicyLike): boolean {
  return Boolean(environment.isProduction);
}

function isPreviewEnvironment(environment: EnvironmentPolicyLike): boolean {
  return Boolean(environment.isPreview);
}

export function canManageEnvironment(
  role: TeamRole | null | undefined,
  environment: EnvironmentPolicyLike
): boolean {
  if (!role) {
    return false;
  }

  if (isProductionEnvironment(environment)) {
    return role === 'owner' || role === 'admin';
  }

  return role === 'owner' || role === 'admin' || role === 'member';
}

export function getEnvironmentGuardReason(environment: EnvironmentPolicyLike): string {
  if (isProductionEnvironment(environment)) {
    return '生产环境只允许 owner 或 admin 执行此操作';
  }

  return '当前成员角色没有权限执行此操作';
}

export function evaluateEnvironmentPolicy(
  environment: EnvironmentPolicyLike
): EnvironmentPolicySnapshot {
  if (isProductionEnvironment(environment)) {
    return {
      level: 'protected',
      reasons: ['生产环境已启用保护'],
      summary: '生产环境已启用保护',
    };
  }

  if (isPreviewEnvironment(environment)) {
    return {
      level: 'preview',
      reasons: ['预览环境会自动回收'],
      summary: '预览环境会自动回收',
    };
  }

  return {
    level: 'normal',
    reasons: [],
    summary: null,
  };
}

export function evaluateMigrationPolicy(input: {
  environment: EnvironmentPolicyLike;
  specification: MigrationPolicyLike;
  allowApprovalBypass?: boolean;
}): MigrationPolicyDecision {
  const warnings: string[] = [];
  const isProduction = isProductionEnvironment(input.environment);
  const isPreview = isPreviewEnvironment(input.environment);

  if (isProduction) {
    warnings.push('这次迁移会作用到生产环境。');
  }

  if (isPreview) {
    warnings.push('这次迁移会作用到预览环境。');
  }

  if (input.specification.compatibility === 'breaking') {
    warnings.push('这次迁移被标记为破坏性变更。');
  }

  const requiresApproval =
    isProduction &&
    !input.allowApprovalBypass &&
    (input.specification.approvalPolicy === 'manual_in_production' ||
      input.specification.compatibility === 'breaking');

  if (isProduction && input.specification.compatibility === 'breaking') {
    warnings.push('生产环境的破坏性迁移必须人工审批。');
  } else if (input.specification.approvalPolicy === 'manual_in_production' && isProduction) {
    warnings.push('生产环境会先暂停，等待人工审批后再执行。');
  }

  return {
    warnings,
    requiresApproval,
    approvalReason: requiresApproval
      ? input.specification.compatibility === 'breaking' && isProduction
        ? '生产环境的破坏性迁移必须人工审批'
        : '生产环境迁移需要人工审批'
      : null,
  };
}

export function evaluateReleasePolicy(release: ReleasePolicyLike): ReleasePolicySnapshot {
  const reasons: string[] = [];
  const environmentPolicy = evaluateEnvironmentPolicy(release.environment);
  const isProduction = environmentPolicy.level === 'protected';
  const hasBreakingMigration = release.migrationRuns.some(
    (run) => run.specification?.compatibility === 'breaking'
  );
  const hasManualProdGate = release.migrationRuns.some(
    (run) => run.specification?.approvalPolicy === 'manual_in_production'
  );
  const requiresApproval = isProduction && (hasBreakingMigration || hasManualProdGate);

  if (isProduction) {
    reasons.push('生产环境已启用保护');
  }

  if (isProduction && hasBreakingMigration) {
    reasons.push('生产环境包含破坏性迁移');
  }

  if (isProduction && hasManualProdGate && !hasBreakingMigration) {
    reasons.push('生产迁移需要人工审批');
  }

  return {
    level: requiresApproval ? 'approval_required' : isProduction ? 'protected' : 'normal',
    reasons,
    summary: requiresApproval
      ? hasBreakingMigration
        ? '生产环境的破坏性迁移必须人工审批'
        : '生产环境迁移需要人工审批'
      : isProduction
        ? '生产环境已启用保护'
        : null,
    requiresApproval,
  };
}
