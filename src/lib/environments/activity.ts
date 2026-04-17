import { buildReleaseDetailPath } from '@/lib/releases/paths';
import type { ReleaseStatusDecoration } from '@/lib/releases/status-presentation';
import {
  getDeploymentStatusDecoration,
  getMigrationStatusDecoration,
  getReleaseStatusDecoration,
} from '@/lib/releases/status-presentation';
import { formatPlatformTimeContext } from '@/lib/time/format';

export interface EnvironmentRecentActivityItem {
  key: string;
  kind: 'release' | 'deployment' | 'migration' | 'governance';
  kindLabel: string;
  title: string;
  summary: string;
  createdAtLabel: string | null;
  href: string | null;
  actionLabel: string | null;
  statusDecoration: ReleaseStatusDecoration | null;
}

interface RecentReleaseInput {
  id: string;
  status: string;
  title: string;
  shortCommitSha?: string | null;
  createdAt?: Date | string | null;
}

interface RecentDeploymentInput {
  id: string;
  status: string;
  serviceName?: string | null;
  createdAt?: Date | string | null;
  releaseId?: string | null;
}

interface RecentPreviewBuildInput {
  status: string;
  sourceLabel?: string | null;
  shortCommitSha?: string | null;
  createdAt?: Date | string | null;
}

interface RecentMigrationInput {
  id: string;
  status: string;
  serviceName?: string | null;
  databaseName?: string | null;
  createdAt?: Date | string | null;
  releaseId?: string | null;
}

interface RecentGovernanceInput {
  key: string;
  label: string;
  summary: string;
  createdAt?: Date | string | null;
}

function toTimestamp(value?: Date | string | null): number {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function buildEnvironmentRecentActivity(input: {
  projectId: string;
  environmentId: string;
  latestRelease?: RecentReleaseInput | null;
  latestDeployment?: RecentDeploymentInput | null;
  latestPreviewBuild?: RecentPreviewBuildInput | null;
  latestMigration?: RecentMigrationInput | null;
  latestGovernance?: RecentGovernanceInput | null;
}): EnvironmentRecentActivityItem[] {
  const items: Array<EnvironmentRecentActivityItem & { timestamp: number }> = [];

  if (input.latestRelease) {
    const statusDecoration = getReleaseStatusDecoration(input.latestRelease.status);
    items.push({
      key: `release:${input.latestRelease.id}`,
      kind: 'release',
      kindLabel: '发布',
      title: '最近发布',
      summary: [
        input.latestRelease.title,
        statusDecoration.label,
        input.latestRelease.shortCommitSha ? `commit ${input.latestRelease.shortCommitSha}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      createdAtLabel: formatPlatformTimeContext(input.latestRelease.createdAt),
      href: buildReleaseDetailPath(input.projectId, input.environmentId, input.latestRelease.id),
      actionLabel: '查看交付',
      statusDecoration,
      timestamp: toTimestamp(input.latestRelease.createdAt),
    });
  }

  if (input.latestDeployment) {
    const statusDecoration = getDeploymentStatusDecoration(input.latestDeployment.status);
    items.push({
      key: `deployment:${input.latestDeployment.id}`,
      kind: 'deployment',
      kindLabel: '部署',
      title: '最近部署',
      summary: [input.latestDeployment.serviceName ?? '服务', statusDecoration.label]
        .filter(Boolean)
        .join(' · '),
      createdAtLabel: formatPlatformTimeContext(input.latestDeployment.createdAt),
      href: input.latestDeployment.releaseId
        ? buildReleaseDetailPath(
            input.projectId,
            input.environmentId,
            input.latestDeployment.releaseId
          )
        : `/projects/${input.projectId}/environments/${input.environmentId}/logs`,
      actionLabel: input.latestDeployment.releaseId ? '查看交付' : '查看日志',
      statusDecoration,
      timestamp: toTimestamp(input.latestDeployment.createdAt),
    });
  }

  if (input.latestPreviewBuild) {
    const statusDecoration = getDeploymentStatusDecoration(input.latestPreviewBuild.status);
    items.push({
      key: `preview-build:${input.environmentId}`,
      kind: 'deployment',
      kindLabel: '构建',
      title: '预览构建',
      summary: [
        input.latestPreviewBuild.sourceLabel ?? '预览环境',
        statusDecoration.label,
        input.latestPreviewBuild.shortCommitSha
          ? `commit ${input.latestPreviewBuild.shortCommitSha}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      createdAtLabel: formatPlatformTimeContext(input.latestPreviewBuild.createdAt),
      href: null,
      actionLabel: null,
      statusDecoration,
      timestamp: toTimestamp(input.latestPreviewBuild.createdAt),
    });
  }

  if (input.latestMigration) {
    const statusDecoration = getMigrationStatusDecoration(input.latestMigration.status);
    items.push({
      key: `migration:${input.latestMigration.id}`,
      kind: 'migration',
      kindLabel: '迁移',
      title: '最近迁移',
      summary: [
        input.latestMigration.serviceName ?? '服务',
        input.latestMigration.databaseName ?? '数据库',
        statusDecoration.label,
      ]
        .filter(Boolean)
        .join(' · '),
      createdAtLabel: formatPlatformTimeContext(input.latestMigration.createdAt),
      href: input.latestMigration.releaseId
        ? buildReleaseDetailPath(
            input.projectId,
            input.environmentId,
            input.latestMigration.releaseId
          )
        : `/projects/${input.projectId}/environments/${input.environmentId}/logs`,
      actionLabel: input.latestMigration.releaseId ? '查看交付' : '查看日志',
      statusDecoration,
      timestamp: toTimestamp(input.latestMigration.createdAt),
    });
  }

  if (input.latestGovernance) {
    items.push({
      key: input.latestGovernance.key,
      kind: 'governance',
      kindLabel: '治理',
      title: input.latestGovernance.label,
      summary: input.latestGovernance.summary,
      createdAtLabel: formatPlatformTimeContext(input.latestGovernance.createdAt),
      href: null,
      actionLabel: null,
      statusDecoration: null,
      timestamp: toTimestamp(input.latestGovernance.createdAt),
    });
  }

  return items
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 3)
    .map(({ timestamp: _timestamp, ...item }) => item);
}
