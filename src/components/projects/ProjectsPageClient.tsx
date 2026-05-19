'use client';

import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PagePanel, PageShell } from '@/components/ui/page-shell';
import { useProjectsRealtime } from '@/hooks/useProjectsRealtime';
import type { ProjectListCard, ProjectListStat } from '@/lib/projects/list-view';
import { getRuntimeStatusDotClass } from '@/lib/runtime/status-presentation';

interface ProjectsPageClientProps {
  initialProjectCards: ProjectListCard[];
  initialStats: ProjectListStat[];
}

export function ProjectsPageClient({ initialProjectCards, initialStats }: ProjectsPageClientProps) {
  const [projectCards, setProjectCards] = useState(initialProjectCards);
  const stats = initialStats.map((stat) =>
    stat.label === '项目' ? { ...stat, value: projectCards.length } : stat
  );
  const shellClassName = 'console-panel';

  useProjectsRealtime({
    projectIds: projectCards.map((project) => project.id),
    onEvent: (event) => {
      if (event.kind === 'project_deleted') {
        setProjectCards((current) => current.filter((project) => project.id !== event.projectId));
        return;
      }

      setProjectCards((current) =>
        current.map((project) =>
          project.id === event.projectId
            ? {
                ...project,
                status: event.project.status,
                statusLabel: event.project.statusLabel,
              }
            : project
        )
      );
    },
  });

  return (
    <PageShell size="wide">
      <PageHeader
        title="项目"
        actions={
          <Button asChild className="h-9 rounded-full px-4">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              新建项目
            </Link>
          </Button>
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {stats.map((stat) => (
          <PagePanel key={stat.label} padding="sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">{stat.value}</div>
          </PagePanel>
        ))}
      </div>

      {projectCards.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="没有项目"
          className="min-h-80"
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {projectCards.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={`${shellClassName} hover-lift flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-white/90`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-secondary/80">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{project.name}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary/72 px-2.5 py-1">
                      {project.teamName}
                    </span>
                    {project.repositoryLabel && (
                      <code className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px]">
                        {project.repositoryLabel}
                      </code>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {project.createdAtLabel}
                  </div>
                </div>
              </div>
              <div className="rounded-full bg-secondary/76 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(project.status)}`}
                  />
                  <span className="text-xs capitalize text-muted-foreground">
                    {project.statusLabel}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
