import type { TeamRole } from '@/lib/db/schema';
import type { Capability } from '@/lib/integrations/domain/models';
import { getRepositoryDefaultBranch } from '@/lib/projects/refs';

interface IntegrationLike {
  id: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  username: string | null;
  createdAt: Date | string;
  grant: {
    id: string;
    expiresAt: Date | string | null;
    revokedAt: Date | string | null;
    capabilities: Capability[];
  } | null;
  repositories: Array<{
    id: string;
    fullName: string;
    defaultBranch: string | null;
    webUrl: string | null;
    createdAt: Date | string;
    projects: Array<{
      id: string;
      name: string;
      team: {
        id: string;
        name: string;
      } | null;
    }>;
  }>;
}

interface TeamScopeLike {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
}

export interface IntegrationSettingsStat {
  label: string;
  value: string;
}

export interface IntegrationControlCard {
  id: string;
  providerLabel: string;
  accountLabel: string;
  statusLabel: string;
  statusTone: 'danger' | 'neutral';
  capabilityLabels: string[];
  summary: string;
  repositoryCountLabel: string;
  boundProjectsLabel: string;
}

export interface IntegrationRepositoryCard {
  id: string;
  fullName: string;
  providerLabel: string;
  defaultBranchLabel: string;
  webUrl: string | null;
  usageSummary: string;
  projectLinks: Array<{
    id: string;
    name: string;
    teamName: string | null;
  }>;
}

export interface IntegrationTeamScopeCard {
  id: string;
  name: string;
  slug: string;
  roleLabel: string;
  summary: string;
}

export interface IntegrationsControlPlaneView {
  headerDescription: string;
  stats: IntegrationSettingsStat[];
  integrations: IntegrationControlCard[];
  repositories: IntegrationRepositoryCard[];
  teamScopes: IntegrationTeamScopeCard[];
  emptySummary: string;
}

function formatProviderLabel(provider: IntegrationLike['provider']): string {
  const labels: Record<IntegrationLike['provider'], string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    'gitlab-self-hosted': 'GitLab 自托管',
  };

  return labels[provider];
}

function formatCapabilityLabel(capability: Capability): string {
  const labels: Record<Capability, string> = {
    read_repo: '读取仓库',
    write_repo: '写入仓库',
    write_workflow: '写入流水线',
  };

  return labels[capability];
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

export function buildIntegrationsControlPlaneView(input: {
  integrations: IntegrationLike[];
  teamScopes: TeamScopeLike[];
}): IntegrationsControlPlaneView {
  const repositories = input.integrations.flatMap((integration) =>
    integration.repositories.map((repository) => ({
      id: repository.id,
      fullName: repository.fullName,
      providerLabel: formatProviderLabel(integration.provider),
      defaultBranchLabel: getRepositoryDefaultBranch(repository),
      webUrl: repository.webUrl,
      usageSummary:
        repository.projects.length > 0
          ? `已绑定 ${repository.projects.length} 个项目`
          : '当前还没有项目绑定这个仓库',
      projectLinks: repository.projects.map((project) => ({
        id: project.id,
        name: project.name,
        teamName: project.team?.name ?? null,
      })),
    }))
  );

  const integrationCards = input.integrations.map((integration) => {
    const grant = integration.grant;
    const isExpired = Boolean(grant?.expiresAt && new Date(grant.expiresAt) < new Date());
    const isRevoked = Boolean(grant?.revokedAt);
    const isConnected = Boolean(grant && !isExpired && !isRevoked);
    const boundProjectCount = integration.repositories.reduce(
      (count, repository) => count + repository.projects.length,
      0
    );

    return {
      id: integration.id,
      providerLabel: formatProviderLabel(integration.provider),
      accountLabel: integration.username ?? '未同步账户名',
      statusLabel: isConnected ? '已连接' : isExpired ? '已过期' : isRevoked ? '已撤销' : '未连接',
      statusTone: isConnected ? 'neutral' : 'danger',
      capabilityLabels: (grant?.capabilities ?? []).map(formatCapabilityLabel),
      summary: isConnected
        ? integration.repositories.length > 0
          ? `当前授权下已记录 ${integration.repositories.length} 个仓库`
          : '当前授权可用，但还没有同步仓库记录'
        : '需要重新授权后，平台才能读取仓库、创建项目和下发发布配置',
      repositoryCountLabel: `${integration.repositories.length} 个仓库`,
      boundProjectsLabel: `${boundProjectCount} 个项目绑定`,
    } satisfies IntegrationControlCard;
  });

  return {
    headerDescription: '代码托管授权、仓库记录和团队可用范围',
    stats: [
      {
        label: '已连接',
        value: String(integrationCards.filter((item) => item.statusLabel === '已连接').length),
      },
      {
        label: '仓库',
        value: String(repositories.length),
      },
      {
        label: '项目绑定',
        value: String(repositories.reduce((count, item) => count + item.projectLinks.length, 0)),
      },
      {
        label: 'Owner 团队',
        value: String(input.teamScopes.filter((team) => team.role === 'owner').length),
      },
    ],
    integrations: integrationCards,
    repositories,
    teamScopes: input.teamScopes.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      roleLabel: formatRoleLabel(team.role),
      summary:
        team.role === 'owner'
          ? '这个团队会优先使用你的授权做仓库读取和发布控制'
          : team.role === 'admin'
            ? '你可以管理团队项目，但平台仓库会话仍优先使用 owner 授权'
            : '当前主要用于查看团队与项目范围',
    })),
    emptySummary: '当前还没有任何代码托管授权或仓库记录。',
  };
}
