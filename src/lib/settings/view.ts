import type { Capability } from '@/lib/integrations/domain/models';

interface UserProfileLike {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date | string;
}

interface IntegrationLike {
  id: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  username: string | null;
  createdAt: Date | string;
  grant: {
    id: string;
    expiresAt: Date | string | null;
    revokedAt: Date | string | null;
    scopeRaw: string | null;
    capabilities: Capability[];
  } | null;
}

export interface SettingsStat {
  label: string;
  value: string;
}

export interface IntegrationCard {
  id: string;
  provider: string;
  accountLabel: string;
  statusLabel: string;
  statusTone: 'danger' | 'neutral';
  capabilities: string[];
  summary: string;
  connectedAtLabel: string;
}

export interface SettingsOverview {
  headerDescription: string;
  stats: SettingsStat[];
  integrations: IntegrationCard[];
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

function formatDateLabel(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export function buildSettingsOverview(
  user: UserProfileLike,
  integrations: IntegrationLike[]
): SettingsOverview {
  const integrationCards = integrations.map((integration) => {
    const grant = integration.grant;
    const isExpired = Boolean(grant?.expiresAt && new Date(grant.expiresAt) < new Date());
    const isRevoked = Boolean(grant?.revokedAt);
    const isConnected = Boolean(grant && !isExpired && !isRevoked);

    return {
      id: integration.id,
      provider: formatProviderLabel(integration.provider),
      accountLabel: integration.username ?? '未同步账户名',
      statusLabel: isConnected ? '已连接' : isExpired ? '已过期' : isRevoked ? '已撤销' : '未连接',
      statusTone: isConnected ? 'neutral' : 'danger',
      capabilities: (grant?.capabilities ?? []).map(formatCapabilityLabel),
      summary: isConnected
        ? grant?.capabilities.length
          ? `当前授权可用于${grant.capabilities.map(formatCapabilityLabel).join('、')}`
          : '当前授权已建立，但没有可识别能力'
        : '需要重新授权后才能执行仓库创建、发布触发和配置下发',
      connectedAtLabel: formatDateLabel(grant?.expiresAt ?? integration.createdAt),
    } satisfies IntegrationCard;
  });

  return {
    headerDescription: '个人资料、账户信息与代码托管连接',
    stats: [
      { label: '加入时间', value: formatDateLabel(user.createdAt) },
      { label: '账户', value: user.id ? `${user.id.slice(0, 8)}...` : '-' },
      { label: '邮箱', value: user.email },
      {
        label: '集成',
        value: `${integrationCards.filter((item) => item.statusLabel === '已连接').length}`,
      },
    ],
    integrations: integrationCards,
  };
}
