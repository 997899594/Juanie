import type { TeamRole } from '@/lib/db/schema';

export interface TeamGovernanceSignal {
  key: string;
  label: string;
  tone: 'danger' | 'neutral';
}

export interface TeamGovernanceCapability {
  key:
    | 'view_members'
    | 'invite_by_email'
    | 'invite_by_link'
    | 'revoke_invitation'
    | 'change_member_role'
    | 'remove_member'
    | 'update_team'
    | 'delete_team';
  label: string;
  allowed: boolean;
  summary: string;
}

export interface TeamGovernancePlatformCapability {
  key:
    | 'edit_project'
    | 'delete_project'
    | 'production_release'
    | 'production_rollback'
    | 'preview_create'
    | 'preview_delete'
    | 'manual_migration';
  label: string;
  allowed: boolean;
  summary: string;
}

export interface TeamGovernanceSnapshot {
  roleLabel: string;
  primarySummary: string;
  platformSummary: string;
  signals: TeamGovernanceSignal[];
  capabilities: TeamGovernanceCapability[];
  platformCapabilities: TeamGovernancePlatformCapability[];
  matrix: TeamGovernanceMatrixRow[];
  platformMatrix: TeamGovernancePlatformMatrixRow[];
}

export interface TeamGovernanceMatrixRow {
  key: TeamGovernanceCapability['key'];
  label: string;
  owner: boolean;
  admin: boolean;
  member: boolean;
}

export interface TeamGovernancePlatformMatrixRow {
  key: TeamGovernancePlatformCapability['key'];
  label: string;
  owner: boolean;
  admin: boolean;
  member: boolean;
}

export interface TeamMemberActionSnapshot {
  canChangeRole: boolean;
  canRemove: boolean;
  roleSummary: string;
  removeSummary: string;
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

export function buildTeamGovernanceSnapshot(role: TeamRole): TeamGovernanceSnapshot {
  const canManageMembers = role === 'owner' || role === 'admin';
  const isOwner = role === 'owner';

  const capabilities: TeamGovernanceCapability[] = [
    {
      key: 'view_members',
      label: '查看成员',
      allowed: true,
      summary: '可查看团队成员和当前邀请状态',
    },
    {
      key: 'invite_by_email',
      label: '邮箱邀请',
      allowed: isOwner,
      summary: isOwner ? '可直接按邮箱邀请成员入组' : '只有 owner 可以直接按邮箱邀请',
    },
    {
      key: 'invite_by_link',
      label: '邀请链接',
      allowed: canManageMembers,
      summary: canManageMembers ? '可生成和分发邀请链接' : '当前角色不能生成邀请链接',
    },
    {
      key: 'revoke_invitation',
      label: '撤销邀请',
      allowed: canManageMembers,
      summary: canManageMembers ? '可撤销未过期邀请' : '当前角色不能撤销邀请',
    },
    {
      key: 'change_member_role',
      label: '调整成员角色',
      allowed: isOwner,
      summary: isOwner ? '可调整非 owner 成员角色' : '只有 owner 可以调整成员角色',
    },
    {
      key: 'remove_member',
      label: '移除成员',
      allowed: canManageMembers,
      summary: canManageMembers ? '可移除非 owner 成员' : '当前角色不能移除团队成员',
    },
    {
      key: 'update_team',
      label: '修改团队设置',
      allowed: isOwner,
      summary: isOwner ? '可修改团队名称和设置' : '只有 owner 可以修改团队设置',
    },
    {
      key: 'delete_team',
      label: '删除团队',
      allowed: isOwner,
      summary: isOwner ? '可删除团队及其项目' : '只有 owner 可以删除团队',
    },
  ];

  const platformCapabilities: TeamGovernancePlatformCapability[] = [
    {
      key: 'edit_project',
      label: '修改项目配置',
      allowed: canManageMembers,
      summary: canManageMembers ? '可修改项目设置和仓库配置' : '当前角色不能修改项目配置',
    },
    {
      key: 'delete_project',
      label: '删除项目',
      allowed: isOwner,
      summary: isOwner ? '可删除项目及其环境资源' : '只有 owner 可以删除项目',
    },
    {
      key: 'production_release',
      label: '生产发布',
      allowed: canManageMembers,
      summary: canManageMembers ? '可向生产环境发起发布和推广' : '生产发布只允许 owner 或 admin',
    },
    {
      key: 'production_rollback',
      label: '生产回滚',
      allowed: canManageMembers,
      summary: canManageMembers ? '可对生产部署执行回滚' : '生产回滚只允许 owner 或 admin',
    },
    {
      key: 'preview_create',
      label: '创建预览环境',
      allowed: true,
      summary: '可按分支或 PR 创建预览环境',
    },
    {
      key: 'preview_delete',
      label: '删除预览环境',
      allowed: canManageMembers,
      summary: canManageMembers
        ? '可删除无活跃发布的预览环境'
        : '删除预览环境只允许 owner 或 admin',
    },
    {
      key: 'manual_migration',
      label: '手动迁移',
      allowed: canManageMembers,
      summary: canManageMembers
        ? '可在数据库控制台执行人工迁移和重试'
        : '手动迁移只允许 owner 或 admin',
    },
  ];

  const matrix: TeamGovernanceMatrixRow[] = [
    {
      key: 'view_members',
      label: '查看成员',
      owner: true,
      admin: true,
      member: true,
    },
    {
      key: 'invite_by_email',
      label: '邮箱邀请',
      owner: true,
      admin: false,
      member: false,
    },
    {
      key: 'invite_by_link',
      label: '邀请链接',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'revoke_invitation',
      label: '撤销邀请',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'change_member_role',
      label: '调整角色',
      owner: true,
      admin: false,
      member: false,
    },
    {
      key: 'remove_member',
      label: '移除成员',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'update_team',
      label: '修改团队',
      owner: true,
      admin: false,
      member: false,
    },
    {
      key: 'delete_team',
      label: '删除团队',
      owner: true,
      admin: false,
      member: false,
    },
  ];

  const platformMatrix: TeamGovernancePlatformMatrixRow[] = [
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
      key: 'production_release',
      label: '生产发布',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'production_rollback',
      label: '生产回滚',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'preview_create',
      label: '创建预览环境',
      owner: true,
      admin: true,
      member: true,
    },
    {
      key: 'preview_delete',
      label: '删除预览环境',
      owner: true,
      admin: true,
      member: false,
    },
    {
      key: 'manual_migration',
      label: '手动迁移',
      owner: true,
      admin: true,
      member: false,
    },
  ];

  const signals: TeamGovernanceSignal[] = [
    {
      key: `role:${role}`,
      label: `当前角色：${formatRoleLabel(role)}`,
      tone: role === 'member' ? 'neutral' : 'danger',
    },
    {
      key: isOwner ? 'owner-controls' : canManageMembers ? 'admin-controls' : 'member-controls',
      label: isOwner ? '拥有完整治理权限' : canManageMembers ? '可管理成员与邀请' : '以协作为主',
      tone: isOwner ? 'danger' : 'neutral',
    },
    {
      key: isOwner
        ? 'platform-owner'
        : canManageMembers
          ? 'platform-admin'
          : 'platform-member-guard',
      label: isOwner
        ? '可操作项目和生产环境'
        : canManageMembers
          ? '可管理生产和手动迁移'
          : '高风险平台操作受保护',
      tone: canManageMembers ? 'danger' : 'neutral',
    },
  ];

  return {
    roleLabel: formatRoleLabel(role),
    primarySummary: isOwner
      ? '你拥有团队的完整治理权限'
      : canManageMembers
        ? '你可以管理成员、邀请和团队协作，但不能删除团队'
        : '你可以查看成员和参与协作，治理类操作受保护',
    platformSummary: isOwner
      ? '你可以管理项目、生产发布、预览环境和手动迁移'
      : canManageMembers
        ? '你可以执行生产发布、回滚、预览清理和手动迁移，但不能删除团队或项目'
        : '你可以创建预览环境并参与协作，生产和人工变更受保护',
    signals,
    capabilities,
    platformCapabilities,
    matrix,
    platformMatrix,
  };
}

export function buildTeamMemberActionSnapshot(input: {
  currentRole: TeamRole;
  targetRole: TeamRole;
  isSelf: boolean;
}): TeamMemberActionSnapshot {
  const isOwner = input.currentRole === 'owner';
  const isAdmin = input.currentRole === 'admin';
  const targetIsOwner = input.targetRole === 'owner';
  const canChangeRole = isOwner && !targetIsOwner;
  const canRemove = !targetIsOwner && (isOwner || (isAdmin && !input.isSelf));

  return {
    canChangeRole,
    canRemove,
    roleSummary: canChangeRole
      ? '可调整角色'
      : targetIsOwner
        ? 'owner 角色不可修改'
        : '只有 owner 可以调整角色',
    removeSummary: canRemove
      ? '可移除成员'
      : targetIsOwner
        ? 'owner 不能被移除'
        : input.isSelf && isAdmin
          ? 'admin 不能移除自己'
          : '当前角色不能移除此成员',
  };
}
