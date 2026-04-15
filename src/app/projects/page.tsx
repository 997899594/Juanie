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

  const { stats, projectCards } = await getProjectsListPageData(session.user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="项目"
        actions={
          <Button asChild className="h-9 rounded-xl px-4">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              新建项目
            </Link>
          </Button>
        }
      />

      <div className="ui-control-muted flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          概览
        </span>
        <span className="text-muted-foreground/50">/</span>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {stats.map((stat) => (
            <span key={stat.label}>
              {stat.label} {stat.value}
            </span>
          ))}
        </div>
      </div>

      {projectCards.length === 0 ? (
        <div className="ui-floating flex min-h-80 flex-col items-center justify-center text-center">
          <div className="mb-4 rounded-2xl bg-secondary/80 p-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">没有项目</h2>
          <Button asChild className="mt-5 rounded-xl">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              新建项目
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {projectCards.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="ui-control hover-lift flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-secondary/60"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/80">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{project.name}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="console-chip">{project.teamName}</span>
                    {project.repositoryLabel && (
                      <code className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px]">
                        {project.repositoryLabel}
                      </code>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {[project.roleLabel, project.createdAtLabel].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="ui-control-muted flex items-center gap-2 rounded-full px-3 py-1.5">
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
