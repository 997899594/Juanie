import { desc, eq } from 'drizzle-orm';
import {
  Box,
  Database,
  ExternalLink,
  FolderKanban,
  GitCommit,
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
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  databases,
  deployments,
  domains,
  environments,
  migrationRuns,
  projects,
  services,
  teams,
} from '@/lib/db/schema';

const navItems = [
  { title: 'Deployments', href: 'deployments', icon: Rocket },
  { title: 'Environments', href: 'environments', icon: Globe },
  { title: 'Resources', href: 'resources', icon: Box },
  { title: 'Webhooks', href: 'webhooks', icon: Webhook },
  { title: 'Settings', href: 'settings', icon: Settings },
];

const statusColors: Record<string, string> = {
  active: 'bg-success',
  running: 'bg-success',
  initializing: 'bg-warning',
  pending: 'bg-warning',
  failed: 'bg-destructive',
  archived: 'bg-muted-foreground',
};

const dbTypeColors: Record<string, string> = {
  postgresql: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  mysql: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  redis: 'bg-red-500/15 text-red-700 dark:text-red-400',
  mongodb: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

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
    recentDeployments,
    recentMigrationRuns,
    deploymentImageCandidates,
  ] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, project.teamId) }),
    db.query.services.findMany({ where: eq(services.projectId, id) }),
    db.query.databases.findMany({ where: eq(databases.projectId, id) }),
    db.query.domains.findMany({ where: eq(domains.projectId, id) }),
    db
      .select({
        id: deployments.id,
        status: deployments.status,
        version: deployments.version,
        commitSha: deployments.commitSha,
        commitMessage: deployments.commitMessage,
        createdAt: deployments.createdAt,
        environmentName: environments.name,
      })
      .from(deployments)
      .innerJoin(environments, eq(environments.id, deployments.environmentId))
      .where(eq(deployments.projectId, id))
      .orderBy(desc(deployments.createdAt))
      .limit(5),
    db.query.migrationRuns.findMany({
      where: eq(migrationRuns.projectId, id),
      orderBy: (run, { desc }) => [desc(run.createdAt)],
      with: {
        database: true,
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>{team?.name}</span>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${statusColors[project.status ?? ''] ?? 'bg-muted-foreground'}`}
                />
                <span className="capitalize">{project.status}</span>
              </div>
            </div>
          </div>
        </div>
        <Link href={`/projects/${id}/settings`}>
          <Button variant="outline" size="sm" className="h-8">
            <Settings className="h-4 w-4 mr-1.5" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Domains / URLs */}
      {projectDomains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {projectDomains.map((domain) => (
            <a
              key={domain.id}
              href={`https://${domain.hostname}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm hover:border-foreground/30 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              {domain.hostname}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-5 gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`/projects/${id}/${item.href}`}
              className="p-4 rounded-lg border bg-card hover:border-foreground/20 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-muted group-hover:bg-foreground group-hover:text-background transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{item.title}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Overview */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h2 className="font-medium text-sm">Overview</h2>
            </div>
            <div className="p-4 space-y-4">
              {project.repository && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Repository</p>
                  <a
                    href={project.repository.webUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    {project.repository.fullName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {project.productionBranch && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Production Branch</p>
                  <code className="text-sm bg-muted px-2 py-0.5 rounded">
                    {project.productionBranch}
                  </code>
                </div>
              )}
              {project.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{project.description}</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Created</span>
                  <span>
                    {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Services */}
          {projectServices.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="font-medium text-sm">Services</h2>
              </div>
              <div className="divide-y">
                {projectServices.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${statusColors[svc.status ?? ''] ?? 'bg-muted-foreground'}`}
                      />
                      <span className="text-sm font-medium">{svc.name}</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {svc.type}
                      </Badge>
                    </div>
                    {svc.port && <span className="text-xs text-muted-foreground">:{svc.port}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Databases */}
          {projectDatabases.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="font-medium text-sm">Databases</h2>
              </div>
              <div className="divide-y">
                {projectDatabases.map((dbItem) => (
                  <div key={dbItem.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{dbItem.name}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${dbTypeColors[dbItem.type] ?? ''}`}
                      >
                        {dbItem.type}
                      </span>
                      {dbItem.scope === 'service' && dbItem.serviceId && (
                        <Badge variant="outline" className="text-xs">
                          {projectServices.find((service) => service.id === dbItem.serviceId)
                            ?.name ?? 'service'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground capitalize">
                          {dbItem.status ?? 'pending'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {latestMigrationByDatabase.get(dbItem.id)
                            ? `migration ${latestMigrationByDatabase.get(dbItem.id)?.status}`
                            : 'no migration runs'}
                        </div>
                      </div>
                      <DatabaseMigrationDialog
                        projectId={id}
                        databaseId={dbItem.id}
                        databaseName={dbItem.name}
                        databaseType={dbItem.type}
                        latestStatus={dbItem.status ?? null}
                        latestImageUrl={
                          latestImageByScope.get(
                            `${dbItem.environmentId}:${dbItem.serviceId ?? 'project'}`
                          ) ??
                          latestImageByScope.get(`${dbItem.environmentId}:project`) ??
                          null
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Recent Deployments */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-medium text-sm">Recent Deployments</h2>
          </div>
          <div className="p-2">
            {recentDeployments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Rocket className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No deployments yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentDeployments.map((deploy) => (
                  <div key={deploy.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${statusColors[deploy.status] ?? 'bg-muted-foreground'}`}
                        />
                        <span className="text-sm font-medium">
                          {deploy.version ? `v${deploy.version}` : '—'}
                        </span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {deploy.environmentName}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {deploy.createdAt ? new Date(deploy.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    {(deploy.commitMessage || deploy.commitSha) && (
                      <div className="flex items-center gap-1.5 pl-3.5">
                        {deploy.commitSha && (
                          <GitCommit className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        {deploy.commitSha && (
                          <code className="text-xs text-muted-foreground">
                            {deploy.commitSha.slice(0, 7)}
                          </code>
                        )}
                        {deploy.commitMessage && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {deploy.commitMessage}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t">
            <Link href={`/projects/${id}/deployments`}>
              <Button variant="ghost" size="sm" className="w-full h-8 text-xs">
                View all deployments
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
