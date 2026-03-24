import { desc, eq } from 'drizzle-orm';
import {
  AlertTriangle,
  Box,
  Database,
  ExternalLink,
  Globe,
  Link2,
  Rocket,
  Settings,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DatabaseMigrationDialog } from '@/components/projects/DatabaseMigrationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  databases,
  deployments,
  domains,
  migrationRuns,
  projects,
  releases,
  services,
  teams,
} from '@/lib/db/schema';

const navItems = [
  { title: '发布', href: 'releases', icon: Rocket },
  { title: '环境', href: 'environments', icon: Globe },
  { title: '资源', href: 'resources', icon: Box },
  { title: '回调', href: 'webhooks', icon: Webhook },
  { title: '设置', href: 'settings', icon: Settings },
];

const statusColors: Record<string, string> = {
  active: 'bg-success',
  running: 'bg-success',
  initializing: 'bg-warning',
  pending: 'bg-warning',
  failed: 'bg-destructive',
  archived: 'bg-muted-foreground',
};

const releaseStatusColors: Record<string, string> = {
  queued: 'bg-muted-foreground',
  planning: 'bg-info',
  migration_pre_running: 'bg-warning',
  migration_pre_failed: 'bg-destructive',
  deploying: 'bg-info',
  verifying: 'bg-info',
  migration_post_running: 'bg-warning',
  degraded: 'bg-warning',
  succeeded: 'bg-success',
  failed: 'bg-destructive',
  canceled: 'bg-muted-foreground',
};

function formatStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    active: '运行中',
    running: '运行中',
    initializing: '初始化中',
    pending: '待处理',
    failed: '失败',
    archived: '已归档',
    queued: '排队中',
    awaiting_approval: '待审批',
    planning: '规划中',
    success: '成功',
    canceled: '已取消',
  };
  return labels[value] ?? value;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { repository: true },
  });

  if (!project) redirect('/projects');

  const [
    team,
    projectServices,
    projectDatabases,
    projectDomains,
    recentReleases,
    recentMigrationRuns,
    deploymentImageCandidates,
  ] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, project.teamId) }),
    db.query.services.findMany({ where: eq(services.projectId, id) }),
    db.query.databases.findMany({ where: eq(databases.projectId, id) }),
    db.query.domains.findMany({ where: eq(domains.projectId, id) }),
    db.query.releases.findMany({
      where: eq(releases.projectId, id),
      orderBy: [desc(releases.createdAt)],
      limit: 20,
      with: {
        environment: true,
        artifacts: {
          with: {
            service: true,
          },
        },
      },
    }),
    db.query.migrationRuns.findMany({
      where: eq(migrationRuns.projectId, id),
      orderBy: (run, { desc }) => [desc(run.createdAt)],
      with: {
        database: true,
        service: true,
        release: true,
      },
    }),
    db.query.deployments.findMany({
      where: eq(deployments.projectId, id),
      orderBy: (deployment, { desc }) => [desc(deployment.createdAt)],
    }),
  ]);

  const latestMigrationByDatabase = new Map<string, (typeof recentMigrationRuns)[number]>();
  for (const run of recentMigrationRuns) {
    if (!latestMigrationByDatabase.has(run.databaseId)) {
      latestMigrationByDatabase.set(run.databaseId, run);
    }
  }

  const latestImageByScope = new Map<string, string>();
  for (const deployment of deploymentImageCandidates) {
    if (!deployment.imageUrl) continue;
    const serviceKey = `${deployment.environmentId}:${deployment.serviceId ?? 'project'}`;
    if (!latestImageByScope.has(serviceKey)) {
      latestImageByScope.set(serviceKey, deployment.imageUrl);
    }
  }

  const latestReleaseByScope = new Map<string, (typeof recentReleases)[number]>();
  for (const release of recentReleases) {
    const projectScopeKey = `${release.environment.id}:project`;
    if (!latestReleaseByScope.has(projectScopeKey)) {
      latestReleaseByScope.set(projectScopeKey, release);
    }

    for (const artifact of release.artifacts) {
      const serviceScopeKey = `${release.environment.id}:${artifact.service.id}`;
      if (!latestReleaseByScope.has(serviceScopeKey)) {
        latestReleaseByScope.set(serviceScopeKey, release);
      }
    }
  }

  const attentionRuns = recentMigrationRuns.filter((run) =>
    ['awaiting_approval', 'failed', 'canceled'].includes(run.status)
  );

  const stats = [
    { label: '服务', value: projectServices.length },
    { label: '数据库', value: projectDatabases.length },
    { label: '待处理', value: attentionRuns.length },
    { label: '发布', value: recentReleases.length },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={project.name}
        description={`${team?.name ?? '团队'} · ${formatStatusLabel(project.status ?? 'pending')}`}
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
            <Link href={`/projects/${id}/settings`}>
              <Settings className="h-3.5 w-3.5" />
              设置
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {projectDomains.length > 0 && (
        <div className="console-panel px-5 py-4">
          <div className="mb-3 text-sm font-semibold">域名</div>
          <div className="flex flex-wrap gap-2">
            {projectDomains.map((domain) => (
              <a
                key={domain.id}
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm transition-colors hover:bg-secondary/70"
              >
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                {domain.hostname}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`/projects/${id}/${item.href}`}
              className="console-panel flex items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">{item.title}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <section className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">概览</div>
            </div>
            <div className="space-y-4 px-5 py-4">
              {project.repository && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    仓库
                  </div>
                  <a
                    href={project.repository.webUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    {project.repository.fullName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {project.productionBranch && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    生产分支
                  </div>
                  <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                    {project.productionBranch}
                  </code>
                </div>
              )}

              {project.description && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    描述
                  </div>
                  <div className="text-sm text-muted-foreground">{project.description}</div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="console-card bg-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    状态
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium capitalize">
                    <div
                      className={`h-2 w-2 rounded-full ${statusColors[project.status ?? ''] ?? 'bg-muted-foreground'}`}
                    />
                    {project.status}
                  </div>
                </div>
                <div className="console-card bg-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    创建时间
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {projectServices.length > 0 && (
            <section className="console-panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold">服务</div>
              </div>
              <div className="space-y-2 p-3">
                {projectServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${statusColors[svc.status ?? ''] ?? 'bg-muted-foreground'}`}
                      />
                      <span className="text-sm font-medium">{svc.name}</span>
                      <Badge variant="secondary" className="capitalize">
                        {svc.type}
                      </Badge>
                    </div>
                    {svc.port && <span className="text-xs text-muted-foreground">:{svc.port}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">待处理</div>
            </div>
            <div className="p-3">
              {attentionRuns.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                  <AlertTriangle className="mb-3 h-5 w-5 text-muted-foreground" />
                  <div className="text-sm font-medium">当前没有待处理项</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {attentionRuns.slice(0, 5).map((run) => (
                    <Link
                      key={run.id}
                      href={
                        run.releaseId
                          ? `/projects/${id}/releases/${run.releaseId}`
                          : `/projects/${id}/releases`
                      }
                      className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            run.status === 'awaiting_approval' ? 'bg-warning' : 'bg-destructive'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{run.database.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {run.service?.name ?? '服务'} · {formatStatusLabel(run.status)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(run.createdAt).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {projectDatabases.length > 0 && (
            <section className="console-panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold">数据库</div>
              </div>
              <div className="space-y-3 p-3">
                {projectDatabases.map((dbItem) => {
                  const latestMigration = latestMigrationByDatabase.get(dbItem.id);
                  const scopeKey = `${dbItem.environmentId}:${dbItem.serviceId ?? 'project'}`;
                  const latestRelease =
                    latestReleaseByScope.get(scopeKey) ??
                    latestReleaseByScope.get(`${dbItem.environmentId}:project`);

                  return (
                    <div key={dbItem.id} className="console-card bg-secondary/20 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Database className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{dbItem.name}</span>
                            <Badge variant="secondary" className="capitalize">
                              {dbItem.type}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {formatStatusLabel(dbItem.status ?? 'pending')}
                            </Badge>
                            {dbItem.scope === 'service' && dbItem.serviceId && (
                              <Badge variant="outline">
                                {projectServices.find((service) => service.id === dbItem.serviceId)
                                  ?.name ?? '服务'}
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>
                              {latestMigration
                                ? `最近迁移：${formatStatusLabel(latestMigration.status)}`
                                : '暂无迁移记录'}
                            </div>
                            {latestRelease ? (
                              <Link
                                href={`/projects/${id}/releases/${latestRelease.id}`}
                                className="inline-flex items-center gap-1 hover:text-foreground"
                              >
                                <span>{latestRelease.summary || '发布'}</span>
                                {latestRelease.sourceCommitSha && (
                                  <code className="font-mono">
                                    {latestRelease.sourceCommitSha.slice(0, 7)}
                                  </code>
                                )}
                              </Link>
                            ) : (
                              <div>暂无关联发布</div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <DatabaseMigrationDialog
                            projectId={id}
                            databaseId={dbItem.id}
                            databaseName={dbItem.name}
                            databaseType={dbItem.type}
                            latestStatus={dbItem.status ?? null}
                            latestImageUrl={
                              latestImageByScope.get(scopeKey) ??
                              latestImageByScope.get(`${dbItem.environmentId}:project`) ??
                              null
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">最近发布</div>
            </div>
            <div className="space-y-2 p-3">
              {recentReleases.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                  还没有发布
                </div>
              ) : (
                recentReleases.slice(0, 5).map((release) => (
                  <Link
                    key={release.id}
                    href={`/projects/${id}/releases/${release.id}`}
                    className="flex items-center justify-between rounded-2xl bg-secondary/20 px-4 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${releaseStatusColors[release.status] ?? 'bg-muted-foreground'}`}
                        />
                        <span className="truncate text-sm font-medium">
                          {release.summary || '发布'}
                        </span>
                        <Badge variant="secondary" className="capitalize">
                          {release.environment.name}
                        </Badge>
                      </div>
                      {(release.sourceCommitSha || release.sourceRef) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {release.sourceCommitSha?.slice(0, 7)} {release.sourceRef}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {release.createdAt ? new Date(release.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
