import type { TeamRole } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';

interface GovernanceEnvironmentLike {
  id: string;
  name?: string;
  isProduction?: boolean | null;
}

export interface ReleasePageGovernanceSnapshot {
  roleLabel: string;
  primarySummary: string;
  manageableEnvironmentIds: string[];
  promoteToProduction: {
    allowed: boolean;
    summary: string;
  };
  manualMigration: {
    allowed: boolean;
    summary: string;
  };
}

export interface ReleaseEnvironmentActionSnapshot {
  canManage: boolean;
  summary: string;
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

export function buildReleaseEnvironmentActionSnapshot(
  role: TeamRole,
  environment: GovernanceEnvironmentLike
): ReleaseEnvironmentActionSnapshot {
  const canManage = canManageEnvironment(role, environment);

  return {
    canManage,
    summary: canManage
      ? environment.isProduction
        ? '可管理当前生产发布与回滚'
        : '可管理当前环境的发布动作'
      : getEnvironmentGuardReason(environment),
  };
}

export function buildReleasePageGovernanceSnapshot(input: {
  role: TeamRole;
  environments: GovernanceEnvironmentLike[];
}): ReleasePageGovernanceSnapshot {
  const manageableEnvironmentIds = input.environments
    .filter((environment) => canManageEnvironment(input.role, environment))
    .map((environment) => environment.id);
  const productionEnvironments = input.environments.filter(
    (environment) => environment.isProduction
  );
  const canPromoteToProduction = productionEnvironments.every((environment) =>
    canManageEnvironment(input.role, environment)
  );
  const canRunManualMigration = input.role === 'owner' || input.role === 'admin';

  return {
    roleLabel: formatRoleLabel(input.role),
    primarySummary:
      input.role === 'owner'
        ? '你可以管理全部发布、生产回滚和迁移审批'
        : input.role === 'admin'
          ? '你可以管理生产发布、回滚和人工迁移，但不能删除项目'
          : '你可以管理非生产发布，生产和人工迁移受保护',
    manageableEnvironmentIds,
    promoteToProduction: {
      allowed: canPromoteToProduction,
      summary:
        productionEnvironments.length === 0
          ? '当前项目还没有生产环境'
          : canPromoteToProduction
            ? '可执行生产发布和生产回滚'
            : '生产发布和回滚只允许 owner 或 admin',
    },
    manualMigration: {
      allowed: canRunManualMigration,
      summary: canRunManualMigration
        ? '可审批、重试和人工执行迁移'
        : '人工迁移和迁移审批只允许 owner 或 admin',
    },
  };
}
