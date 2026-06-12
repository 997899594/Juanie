'use client';

import { FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, PageHeaderAction } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { ActionTile, MetricTile, SectionLabel } from '@/components/ui/platform';
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
          <PageHeaderAction
            label="新建项目"
            href="/projects/new"
            icon={<Plus className="h-4 w-4" />}
          />
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {stats.map((stat) => (
          <MetricTile key={stat.label} label={stat.label} value={stat.value} />
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
            <ActionTile
              key={project.id}
              href={`/projects/${project.id}`}
              title={project.name}
              icon={<FolderKanban className="h-4 w-4" />}
              meta={
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary/72 px-2.5 py-1">
                      {project.teamName}
                    </span>
                    {project.repositoryLabel ? (
                      <code className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px]">
                        {project.repositoryLabel}
                      </code>
                    ) : null}
                  </div>
                  <SectionLabel className="tracking-[0.14em]">
                    {project.createdAtLabel}
                  </SectionLabel>
                </div>
              }
              showArrow={false}
              className="hover-lift justify-between"
              accessory={
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
              }
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
