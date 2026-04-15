import type { TeamRole } from '@/lib/db/schema';
import {
  isPreviewEnvironment as isPreviewEnvironmentByKind,
  isProductionEnvironment as isProductionEnvironmentByKind,
} from '@/lib/environments/model';

interface EnvironmentPolicyLike {
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
  databaseStrategy?: string | null;
  deploymentStrategy?: string | null;
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

export interface PolicySignalSnapshot {
  code:
    | 'production_protected'
    | 'preview_auto_cleanup'
    | 'production_approval_required'
    | 'production_breaking_migration'
    | 'preview_inherited_database'
    | 'preview_isolated_database'
    | 'controlled_rollout'
    | 'canary_rollout'
    | 'blue_green_rollout';
  kind: 'environment' | 'release';
  level: 'protected' | 'preview' | 'approval_required' | 'progressive';
  label: string;
  summary: string;
  nextActionLabel: string | null;
}

export interface MigrationPolicyDecision {
  warnings: string[];
  requiresApproval: boolean;
  approvalReason: string | null;
  signals: MigrationPolicySignalSnapshot[];
  primarySignal: MigrationPolicySignalSnapshot | null;
}

export interface ReleasePolicySnapshot {
  level: 'normal' | 'protected' | 'approval_required';
  reasons: string[];
  summary: string | null;
  requiresApproval: boolean;
  signals: PolicySignalSnapshot[];
  primarySignal: PolicySignalSnapshot | null;
}

export interface EnvironmentPolicySnapshot {
  level: 'normal' | 'protected' | 'preview';
  reasons: string[];
  summary: string | null;
  signals: PolicySignalSnapshot[];
  primarySignal: PolicySignalSnapshot | null;
}

export interface MigrationPolicySignalSnapshot {
  code:
    | 'migration_targets_production'
    | 'migration_targets_preview'
    | 'migration_breaking'
    | 'migration_requires_approval';
  kind: 'migration';
  level: 'warning' | 'approval_required';
  label: string;
  summary: string;
  nextActionLabel: string | null;
}

function isProductionEnvironment(environment: EnvironmentPolicyLike): boolean {
  return isProductionEnvironmentByKind(environment);
}

function isPreviewEnvironment(environment: EnvironmentPolicyLike): boolean {
  return isPreviewEnvironmentByKind(environment);
}

function getRolloutSignal(environment: EnvironmentPolicyLike): PolicySignalSnapshot | null {
  switch (environment.deploymentStrategy) {
    case 'controlled':
      return {
        code: 'controlled_rollout',
        kind: 'environment',
        level: 'progressive',
        label: '受控放量',
        summary: '当前环境采用受控放量策略',
        nextActionLabel: '按阶段观察后继续发布',
      };
    case 'canary':
      return {
        code: 'canary_rollout',
        kind: 'environment',
        level: 'progressive',
        label: '金丝雀',
        summary: '当前环境采用金丝雀发布策略',
        nextActionLabel: '先验证小流量再逐步放量',
      };
    case 'blue_green':
      return {
        code: 'blue_green_rollout',
        kind: 'environment',
        level: 'progressive',
        label: '蓝绿切换',
        summary: '当前环境采用蓝绿切换策略',
        nextActionLabel: '切换前先验证备用版本',
      };
    default:
      return null;
  }
}

function getPreviewDatabaseSignal(environment: EnvironmentPolicyLike): PolicySignalSnapshot | null {
  switch (environment.databaseStrategy) {
    case 'inherit':
      return {
        code: 'preview_inherited_database',
        kind: 'environment',
        level: 'preview',
        label: '继承基础数据库',
        summary: `当前预览环境沿用 ${environment.baseEnvironment?.name ?? '基础环境'} 的数据库`,
        nextActionLabel: '需要隔离时再切换为独立预览库',
      };
    case 'isolated_clone':
      return {
        code: 'preview_isolated_database',
        kind: 'environment',
        level: 'preview',
        label: '独立预览库',
        summary: '当前预览环境使用独立的预览数据库',
        nextActionLabel: '验证完成后回收预览环境',
      };
    default:
      return null;
  }
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
  const signals: PolicySignalSnapshot[] = [];
  const rolloutSignal = getRolloutSignal(environment);

  if (isProductionEnvironment(environment)) {
    const signal: PolicySignalSnapshot = {
      code: 'production_protected',
      kind: 'environment',
      level: 'protected',
      label: '生产环境保护',
      summary: '生产环境已启用保护',
      nextActionLabel: '由 owner 或 admin 执行',
    };

    signals.push(signal);
    if (rolloutSignal) {
      signals.push(rolloutSignal);
    }

    return {
      level: 'protected',
      reasons: signals.map((item) => item.summary),
      summary: signal.summary,
      signals,
      primarySignal: signal,
    };
  }

  if (isPreviewEnvironment(environment)) {
    const databaseSignal = getPreviewDatabaseSignal(environment);
    const signal: PolicySignalSnapshot = {
      code: 'preview_auto_cleanup',
      kind: 'environment',
      level: 'preview',
      label: '预览自动回收',
      summary: '预览环境会自动回收',
      nextActionLabel: '在到期前完成验证',
    };

    if (databaseSignal) {
      signals.push(databaseSignal);
    }
    if (rolloutSignal) {
      signals.push(rolloutSignal);
    }
    signals.push(signal);

    return {
      level: 'preview',
      reasons: signals.map((item) => item.summary),
      summary: signals[0]?.summary ?? signal.summary,
      signals,
      primarySignal: signals[0] ?? signal,
    };
  }

  if (rolloutSignal) {
    return {
      level: 'normal',
      reasons: [rolloutSignal.summary],
      summary: rolloutSignal.summary,
      signals: [rolloutSignal],
      primarySignal: rolloutSignal,
    };
  }

  return {
    level: 'normal',
    reasons: [],
    summary: null,
    signals: [],
    primarySignal: null,
  };
}

export function evaluateMigrationPolicy(input: {
  environment: EnvironmentPolicyLike;
  specification: MigrationPolicyLike;
  allowApprovalBypass?: boolean;
}): MigrationPolicyDecision {
  const warnings: string[] = [];
  const signals: MigrationPolicySignalSnapshot[] = [];
  const isProduction = isProductionEnvironment(input.environment);
  const isPreview = isPreviewEnvironment(input.environment);

  if (isProduction) {
    warnings.push('这次迁移会作用到生产环境。');
    signals.push({
      code: 'migration_targets_production',
      kind: 'migration',
      level: 'warning',
      label: '作用到生产环境',
      summary: '这次迁移会作用到生产环境',
      nextActionLabel: '确认变更窗口和执行时机',
    });
  }

  if (isPreview) {
    warnings.push('这次迁移会作用到预览环境。');
    signals.push({
      code: 'migration_targets_preview',
      kind: 'migration',
      level: 'warning',
      label: '作用到预览环境',
      summary: '这次迁移会作用到预览环境',
      nextActionLabel: '在到期前完成验证',
    });
  }

  if (input.specification.compatibility === 'breaking') {
    warnings.push('这次迁移被标记为破坏性变更。');
    signals.push({
      code: 'migration_breaking',
      kind: 'migration',
      level: isProduction ? 'approval_required' : 'warning',
      label: '破坏性迁移',
      summary: '这次迁移被标记为破坏性变更',
      nextActionLabel: isProduction ? '先处理审批再执行' : '确认兼容窗口后执行',
    });
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

  if (requiresApproval) {
    signals.unshift({
      code: 'migration_requires_approval',
      kind: 'migration',
      level: 'approval_required',
      label: '需要审批',
      summary:
        input.specification.compatibility === 'breaking' && isProduction
          ? '生产环境的破坏性迁移必须人工审批'
          : '生产环境迁移需要人工审批',
      nextActionLabel: '先处理审批再执行',
    });
  }

  const primarySignal = signals[0] ?? null;

  return {
    warnings,
    requiresApproval,
    approvalReason: requiresApproval
      ? input.specification.compatibility === 'breaking' && isProduction
        ? '生产环境的破坏性迁移必须人工审批'
        : '生产环境迁移需要人工审批'
      : null,
    signals,
    primarySignal,
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
  const signals: PolicySignalSnapshot[] = [];

  if (isProduction) {
    reasons.push('生产环境已启用保护');
    signals.push({
      code: 'production_protected',
      kind: 'release',
      level: 'protected',
      label: '生产环境保护',
      summary: '生产环境已启用保护',
      nextActionLabel: '按预检结果继续发布',
    });
  }

  if (isProduction && hasBreakingMigration) {
    reasons.push('生产环境包含破坏性迁移');
    signals.unshift({
      code: 'production_breaking_migration',
      kind: 'release',
      level: 'approval_required',
      label: '破坏性迁移',
      summary: '生产环境的破坏性迁移必须人工审批',
      nextActionLabel: '先处理审批再继续发布',
    });
  }

  if (isProduction && hasManualProdGate && !hasBreakingMigration) {
    reasons.push('生产迁移需要人工审批');
    signals.unshift({
      code: 'production_approval_required',
      kind: 'release',
      level: 'approval_required',
      label: '需要审批',
      summary: '生产环境迁移需要人工审批',
      nextActionLabel: '先处理审批再继续发布',
    });
  }

  const primarySignal = signals[0] ?? null;

  return {
    level: requiresApproval ? 'approval_required' : isProduction ? 'protected' : 'normal',
    reasons,
    summary: primarySignal?.summary ?? null,
    requiresApproval,
    signals,
    primarySignal,
  };
}
