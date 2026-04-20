import type { IntegrationAuthMode, TeamRole } from '@/lib/db/schema';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';
import { formatRuntimeStatusLabel } from '@/lib/runtime/status-presentation';
import {
  buildTeamGovernanceSnapshot,
  buildTeamMemberActionSnapshot,
  type TeamGovernanceSnapshot,
  type TeamMemberActionSnapshot,
} from '@/lib/teams/governance-view';
import { formatPlatformDateTimeShort } from '@/lib/time/format';

interface TeamLike {
  id: string;
  name: string;
  slug: string;
}

interface TeamProjectLike {
  id: string;
  name: string;
  status?: string | null;
  environments: Array<{
    id: string;
    name: string;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  }>;
}

interface TeamMemberRowLike {
  id: string;
  role: TeamRole;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface TeamInvitationLike {
  id: string;
  role: string;
  expires: Date | string;
  createdAt: Date | string;
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: '拥有者',
    admin: '管理员',
    member: '成员',
  };

  return labels[role];
}

function formatDateLabel(value: Date | string | null | undefined): string {
  return formatPlatformDateTimeShort(value) ?? '—';
}

export interface TeamLayoutView {
  title: string;
  description: string;
}

export interface TeamOverviewStat {
  label: string;
  value: string;
}

export interface TeamOverviewProjectCard {
  id: string;
  name: string;
  status: string | null;
  statusLabel: string;
  governance: ReturnType<typeof buildProjectGovernanceSnapshot>;
}

export interface TeamOverviewView {
  stats: TeamOverviewStat[];
  governance: TeamGovernanceSnapshot;
  projects: TeamOverviewProjectCard[];
  memberSummary: string;
}

export interface TeamMembersStat {
  label: string;
  value: string;
}

export interface TeamMemberCard {
  id: string;
  role: TeamRole;
  roleLabel: string;
  createdAtLabel: string;
  user: TeamMemberRowLike['user'];
  actions: TeamMemberActionSnapshot;
}

export interface TeamInvitationCard {
  id: string;
  role: string;
  roleLabel: string;
  expiresLabel: string;
  createdAtLabel: string;
}

export interface TeamMembersView {
  headerDescription: string;
  stats: TeamMembersStat[];
  governance: TeamGovernanceSnapshot;
  members: TeamMemberCard[];
  invitations: TeamInvitationCard[];
}

export interface TeamSettingsView {
  headerDescription: string;
  stats: TeamOverviewStat[];
  governance: TeamGovernanceSnapshot;
  canEdit: boolean;
  canDelete: boolean;
  saveSummary: string;
}

export interface TeamIntegrationBindingCard {
  id: string;
  label: string;
  provider: string;
  authMode: IntegrationAuthMode;
  authModeLabel: string;
  identityOwner: string;
  isDefault: boolean;
  isRevoked: boolean;
  revokedAtLabel: string | null;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
  statusSummary: string;
}

export interface TeamIntegrationsView {
  headerDescription: string;
  stats: TeamOverviewStat[];
  canManage: boolean;
  bindings: TeamIntegrationBindingCard[];
}

interface TeamAIActivityRowLike {
  id: string;
  action: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: Date | string;
  user: {
    name: string | null;
    email: string;
  } | null;
}

export interface TeamAIActivityItem {
  id: string;
  title: string;
  summary: string;
  actorLabel: string;
  createdAtLabel: string;
}

function getPlanLabel(plan?: string | null): string {
  switch (plan) {
    case 'free':
      return 'Free';
    case 'pro':
      return 'Pro';
    case 'scale':
      return 'Scale';
    case 'enterprise':
      return 'Enterprise';
    default:
      return '未知套餐';
  }
}

function getPluginLabel(pluginId?: string | null): string {
  switch (pluginId) {
    case 'release-intelligence':
      return '发布计划';
    case 'incident-intelligence':
      return '故障归因';
    default:
      return pluginId ?? '官方插件';
  }
}

function getActorLabel(user: TeamAIActivityRowLike['user']): string {
  if (!user) {
    return '系统';
  }

  return user.name?.trim() || user.email;
}

function parseAIActivityMetadata(metadata: unknown): {
  plan?: string;
  enabledPlugins?: number;
  totalPlugins?: number;
  pluginId?: string;
} {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const payload = metadata as {
    plan?: string;
    pluginId?: string;
    plugins?: Array<{ enabled?: boolean }>;
  };

  return {
    plan: typeof payload.plan === 'string' ? payload.plan : undefined,
    pluginId: typeof payload.pluginId === 'string' ? payload.pluginId : undefined,
    enabledPlugins: Array.isArray(payload.plugins)
      ? payload.plugins.filter((plugin) => plugin?.enabled).length
      : undefined,
    totalPlugins: Array.isArray(payload.plugins) ? payload.plugins.length : undefined,
  };
}

export function buildTeamAIActivityView(rows: TeamAIActivityRowLike[]): TeamAIActivityItem[] {
  return rows.map((row) => {
    const metadata = parseAIActivityMetadata(row.metadata);

    if (row.action === 'team.ai_control_plane_updated') {
      const pluginSummary =
        typeof metadata.enabledPlugins === 'number' && typeof metadata.totalPlugins === 'number'
          ? ` · 已启用 ${metadata.enabledPlugins}/${metadata.totalPlugins} 个插件`
          : '';

      return {
        id: row.id,
        title: 'AI Control Plane 已更新',
        summary: `套餐切换为 ${getPlanLabel(metadata.plan)}${pluginSummary}`,
        actorLabel: getActorLabel(row.user),
        createdAtLabel: formatPlatformDateTimeShort(row.createdAt) ?? '—',
      };
    }

    if (row.action === 'release.ai_analysis_refreshed') {
      return {
        id: row.id,
        title: '手动刷新 AI 分析',
        summary: `${getPluginLabel(metadata.pluginId)} snapshot 已重新生成`,
        actorLabel: getActorLabel(row.user),
        createdAtLabel: formatPlatformDateTimeShort(row.createdAt) ?? '—',
      };
    }

    return {
      id: row.id,
      title: row.action,
      summary: row.resourceId ? `资源 ${row.resourceId}` : 'AI 相关操作',
      actorLabel: getActorLabel(row.user),
      createdAtLabel: formatPlatformDateTimeShort(row.createdAt) ?? '—',
    };
  });
}

export function buildTeamLayoutView(team: TeamLike): TeamLayoutView {
  return {
    title: team.name,
    description: `@${team.slug}`,
  };
}

export function buildTeamOverviewView(input: {
  role: TeamRole;
  memberCount: number;
  projects: TeamProjectLike[];
}): TeamOverviewView {
  return {
    stats: [
      { label: '项目', value: input.projects.length.toString() },
      { label: '成员', value: input.memberCount.toString() },
    ],
    governance: buildTeamGovernanceSnapshot(input.role),
    projects: input.projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status ?? null,
      statusLabel: formatRuntimeStatusLabel(project.status),
      governance: buildProjectGovernanceSnapshot({
        role: input.role,
        environments: project.environments,
      }),
    })),
    memberSummary: input.memberCount > 0 ? `${input.memberCount} 名成员` : '还没有成员',
  };
}

export function buildTeamMembersView(input: {
  role: TeamRole;
  currentUserId: string;
  members: TeamMemberRowLike[];
  invitations: TeamInvitationLike[];
}): TeamMembersView {
  return {
    headerDescription: `${input.members.length} 名成员${
      input.invitations.length > 0 ? ` · ${input.invitations.length} 个待处理邀请` : ''
    }`,
    stats: [
      { label: '成员', value: input.members.length.toString() },
      { label: '待处理邀请', value: input.invitations.length.toString() },
      { label: '当前角色', value: formatRoleLabel(input.role) },
    ],
    governance: buildTeamGovernanceSnapshot(input.role),
    members: input.members.map((member) => ({
      id: member.id,
      role: member.role,
      roleLabel: formatRoleLabel(member.role),
      createdAtLabel: formatDateLabel(member.createdAt),
      user: member.user,
      actions: buildTeamMemberActionSnapshot({
        currentRole: input.role,
        targetRole: member.role,
        isSelf: member.user.id === input.currentUserId,
      }),
    })),
    invitations: input.invitations.map((invitation) => ({
      id: invitation.id,
      role: invitation.role,
      roleLabel: invitation.role === 'admin' ? '管理员' : '成员',
      expiresLabel: formatDateLabel(invitation.expires),
      createdAtLabel: formatDateLabel(invitation.createdAt),
    })),
  };
}

export function buildTeamSettingsView(input: {
  role: TeamRole;
  projectCount: number;
  memberCount: number;
}): TeamSettingsView {
  const governance = buildTeamGovernanceSnapshot(input.role);
  const canEdit = input.role === 'owner';
  const canDelete = input.role === 'owner';

  return {
    headerDescription: canEdit ? '拥有者权限' : '只读',
    stats: [
      { label: '角色', value: governance.roleLabel },
      { label: '项目', value: input.projectCount.toString() },
      { label: '成员', value: input.memberCount.toString() },
    ],
    governance,
    canEdit,
    canDelete,
    saveSummary: canEdit ? '可修改团队名称和删除团队' : '当前角色只能查看团队治理和成员边界',
  };
}

function getAuthModeLabel(mode: IntegrationAuthMode): string {
  if (mode === 'service') {
    return '服务账号';
  }

  return '个人授权';
}

function getBindingStatus(input: {
  revokedAt: Date | string | null;
  grantRevokedAt: Date | string | null;
  grantExpiresAt: Date | string | null;
  authMode: IntegrationAuthMode;
  ownerStillMember: boolean;
}) {
  if (input.revokedAt) {
    return {
      tone: 'neutral' as const,
      summary: `已撤销（${formatDateLabel(input.revokedAt)}）`,
    };
  }

  if (input.grantRevokedAt) {
    return {
      tone: 'danger' as const,
      summary: '授权已撤销，需要重新授权',
    };
  }

  if (input.grantExpiresAt) {
    const expiresAt = new Date(input.grantExpiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return {
        tone: 'warning' as const,
        summary: `授权已过期（${formatDateLabel(input.grantExpiresAt)}）`,
      };
    }
  }

  if (input.authMode === 'personal' && !input.ownerStillMember) {
    return {
      tone: 'danger' as const,
      summary: '绑定用户已不在团队，建议尽快替换为服务账号',
    };
  }

  if (input.authMode === 'personal') {
    return {
      tone: 'warning' as const,
      summary: '个人授权存在离职风险，建议迁移到服务账号',
    };
  }

  return {
    tone: 'success' as const,
    summary: '绑定健康',
  };
}

export function buildTeamIntegrationsView(input: {
  role: TeamRole;
  bindings: Array<{
    id: string;
    label: string | null;
    provider: string;
    authMode: IntegrationAuthMode;
    isDefault: boolean;
    revokedAt: Date | string | null;
    grantRevokedAt: Date | string | null;
    grantExpiresAt: Date | string | null;
    identityOwner: string | null;
    ownerStillMember: boolean;
  }>;
}): TeamIntegrationsView {
  const canManage = input.role === 'owner' || input.role === 'admin';
  const activeCount = input.bindings.filter((binding) => !binding.revokedAt).length;
  const degradedCount = input.bindings.filter((binding) => {
    const status = getBindingStatus({
      revokedAt: binding.revokedAt,
      grantRevokedAt: binding.grantRevokedAt,
      grantExpiresAt: binding.grantExpiresAt,
      authMode: binding.authMode,
      ownerStillMember: binding.ownerStillMember,
    });

    return status.tone === 'danger' || status.tone === 'warning';
  }).length;

  return {
    headerDescription: canManage ? '可管理团队默认执行身份' : '只读查看团队执行身份',
    stats: [
      { label: '活跃绑定', value: activeCount.toString() },
      { label: '异常提醒', value: degradedCount.toString() },
      { label: '当前角色', value: formatRoleLabel(input.role) },
    ],
    canManage,
    bindings: input.bindings.map((binding) => {
      const status = getBindingStatus({
        revokedAt: binding.revokedAt,
        grantRevokedAt: binding.grantRevokedAt,
        grantExpiresAt: binding.grantExpiresAt,
        authMode: binding.authMode,
        ownerStillMember: binding.ownerStillMember,
      });

      return {
        id: binding.id,
        label: binding.label ?? `${binding.provider}:${binding.id.slice(0, 8)}`,
        provider: binding.provider,
        authMode: binding.authMode,
        authModeLabel: getAuthModeLabel(binding.authMode),
        identityOwner: binding.identityOwner ?? '未知用户',
        isDefault: binding.isDefault,
        isRevoked: Boolean(binding.revokedAt),
        revokedAtLabel: binding.revokedAt ? formatDateLabel(binding.revokedAt) : null,
        statusTone: status.tone,
        statusSummary: status.summary,
      };
    }),
  };
}
