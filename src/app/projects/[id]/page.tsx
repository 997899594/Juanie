import { desc, eq } from 'drizzle-orm';
import { Box, ExternalLink, FolderKanban, Globe, Rocket, Settings, Webhook } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, projects, teams } from '@/lib/db/schema';

const navItems = [
  { title: 'Deployments', href: 'deployments', icon: Rocket },
  { title: 'Environments', href: 'environments', icon: Globe },
  { title: 'Resources', href: 'resources', icon: Box },
  { title: 'Webhooks', href: 'webhooks', icon: Webhook },
  { title: 'Settings', href: 'settings', icon: Settings },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      repository: true,
    },
  });

  if (!project) {
    redirect('/projects');
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, project.teamId),
  });

  const recentDeployments = await db.query.deployments.findMany({
    where: eq(deployments.projectId, id),
    orderBy: [desc(deployments.createdAt)],
    limit: 5,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
                  className={`h-1.5 w-1.5 rounded-full ${
                    project.status === 'active'
                      ? 'bg-success'
                      : project.status === 'initializing'
                        ? 'bg-warning'
                        : project.status === 'failed'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground'
                  }`}
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
                  <div key={deploy.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          deploy.status === 'running'
                            ? 'bg-success'
                            : deploy.status === 'failed'
                              ? 'bg-destructive'
                              : 'bg-muted-foreground'
                        }`}
                      />
                      <span className="text-sm">v{deploy.version ?? '1.0.0'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {deploy.createdAt ? new Date(deploy.createdAt).toLocaleDateString() : '—'}
                    </span>
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
