import type { TeamRole } from '@/lib/db/schema';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';
import {
  buildTeamGovernanceSnapshot,
  buildTeamMemberActionSnapshot,
  type TeamGovernanceSnapshot,
  type TeamMemberActionSnapshot,
} from '@/lib/teams/governance-view';

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
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString();
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
      statusLabel: project.status ?? 'active',
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
