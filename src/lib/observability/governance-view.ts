import type { TeamRole } from '@/lib/db/schema';

export interface ObservabilityGovernanceSnapshot {
  roleLabel: string;
  primarySummary: string;
  resources: {
    allowed: boolean;
    summary: string;
  };
  logs: {
    allowed: boolean;
    summary: string;
  };
  signals: Array<{
    key: string;
    label: string;
    tone: 'danger' | 'neutral';
  }>;
}

function formatRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  return labels[role];
}

export function buildObservabilityGovernanceSnapshot(
  role: TeamRole
): ObservabilityGovernanceSnapshot {
  return {
    roleLabel: formatRoleLabel(role),
    primarySummary:
      role === 'owner'
        ? '你可以查看项目资源与实时日志，并管理高风险发布入口'
        : role === 'admin'
          ? '你可以查看项目资源与实时日志，并协助排障与发布'
          : '你可以查看项目资源与实时日志，用于日常排障与协作',
    resources: {
      allowed: true,
      summary: '团队成员都可以查看当前项目的 Kubernetes 资源。',
    },
    logs: {
      allowed: true,
      summary: '团队成员都可以查看 Pod 日志与实时日志流。',
    },
    signals: [
      {
        key: `observability-role:${role}`,
        label: `当前角色：${formatRoleLabel(role)}`,
        tone: role === 'member' ? 'neutral' : 'danger',
      },
    ],
  };
}
