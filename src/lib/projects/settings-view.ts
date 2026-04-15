import type { TeamRole } from '@/lib/db/schema';
import { isPreviewEnvironment, isProductionEnvironment } from '@/lib/environments/model';
import { canManageEnvironment, evaluateEnvironmentPolicy } from '@/lib/policies/delivery';

interface GovernanceEnvironmentLike {
  id: string;
  name: string;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
}

export interface ProjectGovernanceCapability {
  key:
    | 'edit_project'
    | 'delete_project'
    | 'manage_production'
    | 'manage_preview'
    | 'manual_migration';
  label: string;
  allowed: boolean;
  summary: string;
}

export interface ProjectGovernanceMatrixRow {
  key: ProjectGovernanceCapability['key'];
  label: string;
  owner: boolean;
  admin: boolean;
  member: boolean;
}

export interface ProjectGovernanceSignal {
  key: string;
  label: string;
  tone: 'danger' | 'neutral';
}

export interface ProjectGovernanceSnapshot {
  roleLabel: string;
  primarySummary: string;
  capabilities: ProjectGovernanceCapability[];
  matrix: ProjectGovernanceMatrixRow[];
  signals: ProjectGovernanceSignal[];
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

function dedupeSignals(signals: ProjectGovernanceSignal[]): ProjectGovernanceSignal[] {
  const seen = new Set<string>();

  return signals.filter((signal) => {
    if (seen.has(signal.key)) {
      return false;
    }
    seen.add(signal.key);
    return true;
  });
}

export function buildProjectGovernanceSnapshot(input: {
  role: TeamRole;
  environments: GovernanceEnvironmentLike[];
}): ProjectGovernanceSnapshot {
  const productionEnvironments = input.environments.filter((environment) =>
    isProductionEnvironment(environment)
  );
  const previewEnvironments = input.environments.filter((environment) =>
    isPreviewEnvironment(environment)
  );
  const canEditProject = input.role === 'owner' || input.role === 'admin';
  const canDeleteProject = input.role === 'owner';
  const canManageProduction = productionEnvironments.every((environment) =>
    canManageEnvironment(input.role, environment)
  );
  const canManagePreview = previewEnvironments.every((environment) =>
    canManageEnvironment(input.role, environment)
  );
  const canRunManualMigration = input.role === 'owner' || input.role === 'admin';

  const capabilities: ProjectGovernanceCapability[] = [
    {
      key: 'edit_project',
      label: '修改项目配置',
      allowed: canEditProject,
      summary: canEditProject ? '可修改常规和 Git 配置' : '当前角色不能修改项目配置',
    },
    {
      key: 'delete_project',
      label: '删除项目',
      allowed: canDeleteProject,
      summary: canDeleteProject ? '可执行项目删除' : '只有 owner 可以删除项目',
    },
    {
      key: 'manage_production',
      label: '操作生产环境',
      allowed: canManageProduction,
      summary:
        productionEnvironments.length === 0
          ? '当前项目还没有生产环境'
          : canManageProduction
            ? '可执行生产发布、回滚和审批操作'
            : '生产环境只允许 owner 或 admin 执行',
    },
    {
      key: 'manage_preview',
      label: '管理预览环境',
      allowed: canManagePreview,
      summary:
        previewEnvironments.length === 0
          ? '当前项目还没有预览环境'
          : canManagePreview
            ? '可创建和回收预览环境'
            : '当前角色不能管理预览环境',
    },
    {
      key: 'manual_migration',
      label: '手动迁移',
      allowed: canRunManualMigration,
      summary: canRunManualMigration
        ? '可在数据库控制台执行人工迁移'
        : '只有 owner 或 admin 可以执行手动迁移',
    },
  ];

  const matrix: ProjectGovernanceMatrixRow[] = [
    {
      key: 'edit_project',
      label: '修改项目配置',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'delete_project',
      label: '删除项目',
      owner: true,
      admin: false,
      member: false,
    },
    {
      key: 'manage_production',
      label: '操作生产环境',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'manage_preview',
      label: '管理预览环境',
      owner: true,
      admin: true,
      member: true,
    },
    {
      key: 'manual_migration',
      label: '手动迁移',
      owner: true,
      admin: true,
      member: false,
    },
  ];

  const policySignals: ProjectGovernanceSignal[] = input.environments
    .map((environment) => evaluateEnvironmentPolicy(environment).primarySignal)
    .filter((signal): signal is NonNullable<typeof signal> => Boolean(signal))
    .map((signal) => {
      const tone: ProjectGovernanceSignal['tone'] =
        signal.level === 'protected' || signal.level === 'approval_required' ? 'danger' : 'neutral';

      return {
        key: `environment:${signal.code}`,
        label: signal.label,
        tone,
      };
    });

  const roleSignals: ProjectGovernanceSignal[] = [
    {
      key: `role:${input.role}`,
      label: `当前角色：${formatRoleLabel(input.role)}`,
      tone: input.role === 'member' ? 'neutral' : 'danger',
    },
  ];

  return {
    roleLabel: formatRoleLabel(input.role),
    primarySummary:
      input.role === 'owner'
        ? '你拥有当前项目的完整治理权限'
        : input.role === 'admin'
          ? '你可以管理发布、生产环境和手动迁移，但不能删除项目'
          : '你可以参与常规环境发布，但生产和手动迁移受保护',
    capabilities,
    matrix,
    signals: dedupeSignals([...roleSignals, ...policySignals]),
  };
}
