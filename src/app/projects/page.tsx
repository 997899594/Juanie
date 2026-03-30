import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { getProjectsListPageData } from '@/lib/projects/list-service';

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { headerDescription, stats, projectCards } = await getProjectsListPageData(session.user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="项目"
        description={headerDescription}
        actions={
          <Button asChild className="h-9 rounded-xl px-4">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              新建项目
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {projectCards.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有项目</h2>
          <p className="mt-2 text-sm text-muted-foreground">新建一个项目开始使用。</p>
          <Button asChild className="mt-5 rounded-xl">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              新建项目
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {projectCards.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="console-panel flex items-center justify-between px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{project.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{project.teamName}</span>
                    {project.repositoryLabel && (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                        {project.repositoryLabel}
                      </code>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {[project.roleLabel, project.createdAtLabel].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    project.status === 'active'
                      ? 'bg-success'
                      : project.status === 'initializing'
                        ? 'bg-warning'
                        : project.status === 'failed'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground'
                  }`}
                />
                <span className="text-xs capitalize text-muted-foreground">
                  {project.statusLabel}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
