import { desc, eq } from 'drizzle-orm';
import { ArrowRight, Box, FolderKanban, Plus, Rocket, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, projects, teamMembers } from '@/lib/db/schema';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, session.user.id),
    with: {
      team: true,
    },
  });

  const teamIds = userTeams.map((tm) => tm.teamId);

  const userProjects =
    teamIds.length > 0
      ? await db.query.projects.findMany({
          where: (p, { inArray }) => inArray(p.teamId, teamIds),
          limit: 5,
          orderBy: [desc(projects.createdAt)],
          with: {
            repository: true,
          },
        })
      : [];

  const recentDeployments =
    teamIds.length > 0
      ? await db.query.deployments.findMany({
          limit: 5,
          orderBy: [desc(deployments.createdAt)],
        })
      : [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back{session.user.name ? `, ${session.user.name}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{userProjects.length}</p>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{userTeams.length}</p>
              <p className="text-xs text-muted-foreground">Teams</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted">
              <Rocket className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{recentDeployments.length}</p>
              <p className="text-xs text-muted-foreground">Deployments</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted">
              <Box className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">—</p>
              <p className="text-xs text-muted-foreground">Resources</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-medium text-sm">Recent Projects</h2>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                View all
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="p-2">
            {userProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-full bg-muted mb-3">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No projects yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Create your first project to get started
                </p>
                <Link href="/projects/new">
                  <Button size="sm" className="h-8">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {userProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.repository?.fullName || 'No repository'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          project.status === 'active'
                            ? 'bg-success'
                            : project.status === 'initializing'
                              ? 'bg-warning'
                              : 'bg-muted-foreground'
                        }`}
                      />
                      <span className="text-xs text-muted-foreground capitalize">
                        {project.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-medium text-sm">Recent Deployments</h2>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                View all
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="p-2">
            {recentDeployments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-full bg-muted mb-3">
                  <Rocket className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No deployments yet</p>
                <p className="text-xs text-muted-foreground">
                  Deployments will appear when you push
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {recentDeployments.map((deployment) => (
                  <div key={deployment.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          deployment.status === 'running'
                            ? 'bg-success'
                            : deployment.status === 'failed'
                              ? 'bg-destructive'
                              : deployment.status === 'deploying'
                                ? 'bg-warning animate-pulse-subtle'
                                : 'bg-muted-foreground'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">v{deployment.version || '1.0.0'}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {deployment.status}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {deployment.createdAt ? formatRelativeTime(deployment.createdAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/projects/new"
          className="group p-4 rounded-lg border bg-card hover:border-foreground/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-black text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium group-hover:underline">New Project</p>
              <p className="text-xs text-muted-foreground">Create from template</p>
            </div>
          </div>
        </Link>
        <Link
          href="/teams"
          className="group p-4 rounded-lg border bg-card hover:border-foreground/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium group-hover:underline">Manage Teams</p>
              <p className="text-xs text-muted-foreground">Invite members</p>
            </div>
          </div>
        </Link>
        <Link
          href="/settings"
          className="group p-4 rounded-lg border bg-card hover:border-foreground/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted">
              <Box className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium group-hover:underline">Connect Git Provider</p>
              <p className="text-xs text-muted-foreground">GitHub / GitLab</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
