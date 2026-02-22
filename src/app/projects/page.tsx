import { desc, eq, inArray } from 'drizzle-orm';
import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, repositories, teamMembers, teams } from '@/lib/db/schema';

export default async function ProjectsPage() {
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
      ? await db
          .select({
            project: projects,
            teamName: teams.name,
            repoFullName: repositories.fullName,
          })
          .from(projects)
          .innerJoin(teams, eq(teams.id, projects.teamId))
          .leftJoin(repositories, eq(repositories.id, projects.repositoryId))
          .where(inArray(projects.teamId, teamIds))
          .orderBy(desc(projects.createdAt))
      : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {userProjects.length} project{userProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" className="h-8">
            <Plus className="h-4 w-4 mr-1.5" />
            New Project
          </Button>
        </Link>
      </div>

      {userProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-2">No projects yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first project to get started
          </p>
          <Link href="/projects/new">
            <Button>
              <Plus className="h-4 w-4 mr-1.5" />
              New Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {userProjects.map((item) => (
            <Link
              key={item.project.id}
              href={`/projects/${item.project.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg border"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{item.project.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.teamName}</span>
                    {item.repoFullName && (
                      <>
                        <span>·</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                          {item.repoFullName}
                        </code>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.project.status === 'active'
                        ? 'bg-success'
                        : item.project.status === 'initializing'
                          ? 'bg-warning'
                          : item.project.status === 'failed'
                            ? 'bg-destructive'
                            : 'bg-muted-foreground'
                    }`}
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {item.project.status}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.project.createdAt
                    ? new Date(item.project.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
