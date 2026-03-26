import type { TeamRole } from '@/lib/db/schema';

export interface EnvironmentPageGovernanceSnapshot {
  roleLabel: string;
  createPreview: {
    allowed: boolean;
    summary: string;
  };
  createIsolatedPreview: {
    allowed: boolean;
    summary: string;
  };
  deletePreview: {
    allowed: boolean;
    summary: string;
  };
  manageEnvVars: {
    allowed: boolean;
    summary: string;
  };
}

export interface PreviewEnvironmentActionSnapshot {
  canDelete: boolean;
  deleteSummary: string;
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

export function buildEnvironmentPageGovernanceSnapshot(
  role: TeamRole
): EnvironmentPageGovernanceSnapshot {
  const canDeletePreview = role === 'owner' || role === 'admin';

  return {
    roleLabel: formatRoleLabel(role),
    createPreview: {
      allowed: true,
      summary: '团队成员都可以按分支或 PR 创建预览环境',
    },
    createIsolatedPreview: {
      allowed: canDeletePreview,
      summary: canDeletePreview
        ? '可为预览环境创建独立数据库'
        : '独立预览库只允许 owner 或 admin 创建',
    },
    deletePreview: {
      allowed: canDeletePreview,
      summary: canDeletePreview
        ? '可删除没有活跃发布的预览环境'
        : '删除预览环境只允许 owner 或 admin',
    },
    manageEnvVars: {
      allowed: canDeletePreview,
      summary: canDeletePreview ? '可编辑和删除当前环境变量' : '环境变量变更只允许 owner 或 admin',
    },
  };
}

export function buildPreviewEnvironmentActionSnapshot(
  role: TeamRole
): PreviewEnvironmentActionSnapshot {
  const canDelete = role === 'owner' || role === 'admin';

  return {
    canDelete,
    deleteSummary: canDelete
      ? '可删除没有活跃发布的预览环境'
      : '只有 owner 或 admin 可以删除预览环境',
  };
}
