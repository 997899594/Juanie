import type { TeamRole } from '@/lib/db/schema';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';

interface TeamScopeLike {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
  providerLabels: string[];
  capabilities: string[];
}

export interface CreateProjectTeamScope {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
  roleLabel: string;
  providerLabels: string[];
  importEnabled: boolean;
  createEnabled: boolean;
  importSummary: string;
  createSummary: string;
  importSignals: PlatformSignalSnapshot;
  createSignals: PlatformSignalSnapshot;
}

export interface CreateProjectPageDataView {
  headerDescription: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
  platformSignals: PlatformSignalSnapshot;
  teamScopes: CreateProjectTeamScope[];
}

export interface CreateProjectSubmissionSnapshot {
  code: 'team_scope_missing' | 'repo_read_missing' | 'repo_write_missing' | 'project_create_failed';
  message: string;
  platformSignals: PlatformSignalSnapshot;
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

function buildCreateCapabilitySignals(input: {
  enabled: boolean;
  providerLabels: string[];
  capabilityLabel: string;
  successSummary: string;
  failureSummary: string;
}): PlatformSignalSnapshot {
  if (input.enabled) {
    return buildPlatformSignalSnapshot({
      customSignals: [
        {
          key: `create:${input.capabilityLabel}:enabled`,
          label: input.capabilityLabel,
          tone: 'neutral',
        },
      ],
      customSummary: input.successSummary,
      customNextActionLabel: '继续创建项目',
    });
  }

  return buildPlatformSignalSnapshot({
    issue: {
      code: `create:${input.capabilityLabel}:disabled`,
      label: `${input.capabilityLabel}未就绪`,
      summary: input.failureSummary,
      nextActionLabel: '先完成代码托管授权',
    },
  });
}

export function buildCreateProjectPageData(input: {
  teamScopes: TeamScopeLike[];
}): CreateProjectPageDataView {
  const teamScopes = input.teamScopes.map((team) => {
    const capabilitySet = new Set(team.capabilities);
    const importEnabled = capabilitySet.has('read_repo');
    const createEnabled = capabilitySet.has('write_repo');
    const providerSummary =
      team.providerLabels.length > 0
        ? `${team.providerLabels.join(' / ')} 授权可用`
        : '当前团队还没有可用的代码托管授权';
    const importSummary = importEnabled
      ? team.providerLabels.length > 0
        ? `${team.providerLabels.join(' / ')} 授权可读取仓库`
        : '当前团队具备仓库读取能力'
      : '当前团队还没有可用的仓库读取授权';
    const createSummary = createEnabled
      ? team.providerLabels.length > 0
        ? `${team.providerLabels.join(' / ')} 授权可创建仓库`
        : '当前团队具备仓库创建能力'
      : '当前团队还没有可用的仓库创建授权';

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      role: team.role,
      roleLabel: formatRoleLabel(team.role),
      providerLabels: team.providerLabels,
      importEnabled,
      createEnabled,
      importSummary,
      createSummary,
      importSignals: buildCreateCapabilitySignals({
        enabled: importEnabled,
        providerLabels: team.providerLabels,
        capabilityLabel: '仓库导入',
        successSummary: importSummary,
        failureSummary: `${providerSummary}，暂时不能导入现有仓库`,
      }),
      createSignals: buildCreateCapabilitySignals({
        enabled: createEnabled,
        providerLabels: team.providerLabels,
        capabilityLabel: '新建仓库',
        successSummary: createSummary,
        failureSummary: `${providerSummary}，暂时不能创建新仓库`,
      }),
    } satisfies CreateProjectTeamScope;
  });

  const importReadyCount = teamScopes.filter((team) => team.importEnabled).length;
  const createReadyCount = teamScopes.filter((team) => team.createEnabled).length;
  const platformSignals =
    teamScopes.length === 0
      ? buildPlatformSignalSnapshot({
          issue: {
            code: 'create:no-team-scope',
            label: '没有可用团队',
            summary: '当前账号还没有可用于创建项目的团队',
            nextActionLabel: '先创建团队',
          },
        })
      : buildPlatformSignalSnapshot({
          customSignals: [
            {
              key: 'create:team-scope',
              label: `${teamScopes.length} 个团队可用`,
              tone: 'neutral',
            },
          ],
          customSummary: `当前有 ${importReadyCount} 个团队可导入仓库，${createReadyCount} 个团队可新建仓库`,
          customNextActionLabel: '选择团队和创建模式',
        });

  return {
    headerDescription: `${teamScopes.length} 个团队可用`,
    stats: [
      { label: '团队', value: String(teamScopes.length) },
      { label: '可导入', value: String(importReadyCount) },
      { label: '可建仓', value: String(createReadyCount) },
    ],
    platformSignals,
    teamScopes,
  };
}

export function buildCreateProjectSubmissionSnapshot(input: {
  code: 'team_scope_missing' | 'repo_read_missing' | 'repo_write_missing' | 'project_create_failed';
  message?: string | null;
}): CreateProjectSubmissionSnapshot {
  switch (input.code) {
    case 'team_scope_missing':
      return {
        code: input.code,
        message: input.message || '当前团队不可用于创建项目',
        platformSignals: buildPlatformSignalSnapshot({
          issue: {
            code: input.code,
            label: '团队不可用',
            summary: input.message || '当前团队没有可用授权，无法创建项目',
            nextActionLabel: '切换团队或先完成授权',
          },
        }),
      };
    case 'repo_read_missing':
      return {
        code: input.code,
        message: input.message || '当前团队没有可用的仓库读取授权',
        platformSignals: buildPlatformSignalSnapshot({
          issue: {
            code: input.code,
            label: '仓库导入不可用',
            summary: input.message || '当前团队还没有可用的仓库读取授权',
            nextActionLabel: '先完成仓库读取授权',
          },
        }),
      };
    case 'repo_write_missing':
      return {
        code: input.code,
        message: input.message || '当前团队没有可用的仓库创建授权',
        platformSignals: buildPlatformSignalSnapshot({
          issue: {
            code: input.code,
            label: '新建仓库不可用',
            summary: input.message || '当前团队还没有可用的仓库创建授权',
            nextActionLabel: '先完成仓库创建授权',
          },
        }),
      };
    default:
      return {
        code: 'project_create_failed',
        message: input.message || '创建项目失败',
        platformSignals: buildPlatformSignalSnapshot({
          issue: {
            code: 'project_create_failed',
            label: '创建项目失败',
            summary: input.message || '平台无法完成项目创建',
            nextActionLabel: '检查配置后重试',
          },
        }),
      };
  }
}
