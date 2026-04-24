import type { TeamRole } from '@/lib/db/schema';
import { isProductionEnvironment } from '@/lib/environments/model';
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
  promotion: {
    allowed: boolean;
    summary: string;
    manageableTargetIds: string[];
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
      ? isProductionEnvironment(environment)
        ? '可管理当前生产发布与回滚'
        : '可管理当前环境的发布动作'
      : getEnvironmentGuardReason(environment),
  };
}

export function buildReleasePageGovernanceSnapshot(input: {
  role: TeamRole;
  environments: GovernanceEnvironmentLike[];
  promotionTargets?: GovernanceEnvironmentLike[];
}): ReleasePageGovernanceSnapshot {
  const manageableEnvironmentIds = input.environments
    .filter((environment) => canManageEnvironment(input.role, environment))
    .map((environment) => environment.id);
  const promotionTargets = input.promotionTargets ?? [];
  const manageablePromotionTargets = promotionTargets.filter((environment) =>
    canManageEnvironment(input.role, environment)
  );
  const canRunManualMigration = input.role === 'owner' || input.role === 'admin';

  return {
    roleLabel: formatRoleLabel(input.role),
    primarySummary:
      input.role === 'owner'
        ? '你可以管理全部发布、生产回滚和迁移审批'
        : input.role === 'admin'
          ? '你可以管理受保护环境提升、回滚和人工迁移，但不能删除项目'
          : '你可以管理非生产发布，受保护环境提升和人工迁移受限',
    manageableEnvironmentIds,
    promotion: {
      allowed: manageablePromotionTargets.length > 0,
      summary:
        promotionTargets.length === 0
          ? '当前项目还没有配置环境提升链路'
          : manageablePromotionTargets.length === 0
            ? '当前提升链路的目标环境受保护'
            : manageablePromotionTargets.length === promotionTargets.length
              ? '可执行环境提升与回滚'
              : '部分提升链路受保护，当前仅可操作可管理目标环境',
      manageableTargetIds: manageablePromotionTargets.map((environment) => environment.id),
    },
    manualMigration: {
      allowed: canRunManualMigration,
      summary: canRunManualMigration
        ? '可审批、重试和人工执行迁移'
        : '人工迁移和迁移审批只允许 owner 或 admin',
    },
  };
}
