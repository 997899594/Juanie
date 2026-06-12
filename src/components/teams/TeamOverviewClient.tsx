'use client';

import { FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionTile, MetricTile } from '@/components/ui/platform';
import { useProjectsRealtime } from '@/hooks/useProjectsRealtime';
import type { getTeamOverviewPageData } from '@/lib/teams/service';

interface TeamOverviewClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamOverviewPageData>>>;
}

export function TeamOverviewClient({ teamId, initialData }: TeamOverviewClientProps) {
  const [overview, setOverview] = useState(initialData.overview);

  useProjectsRealtime({
    projectIds: overview.projects.map((project) => project.id),
    onEvent: (event) => {
      if (event.kind === 'project_deleted') {
        setOverview((current) => {
          const exists = current.projects.some((project) => project.id === event.projectId);
          return {
            ...current,
            stats: current.stats.map((stat) =>
              stat.label === '项目' && exists
                ? { ...stat, value: String(Math.max(0, Number(stat.value) - 1)) }
                : stat
            ),
            projects: current.projects.filter((project) => project.id !== event.projectId),
          };
        });
        return;
      }

      setOverview((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === event.projectId
            ? {
                ...project,
                status: event.project.status,
                statusLabel: event.project.statusLabel,
              }
            : project
        ),
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        {overview.stats.map((stat) => (
          <MetricTile key={stat.label} label={stat.label} value={stat.value} size="lg" />
        ))}
        <div className="flex items-stretch gap-2 md:justify-end">
          <ActionTile
            href={`/teams/${teamId}/members`}
            title="成员"
            density="compact"
            className="flex-1 md:w-28 md:flex-none"
          />
          <ActionTile
            href="/projects/new"
            title="新建项目"
            icon={<Plus className="h-4 w-4" />}
            density="compact"
            className="flex-1 md:w-36 md:flex-none"
          />
        </div>
      </div>

      {overview.projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8 text-muted-foreground" />}
          title="没有项目"
          className="min-h-80"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {overview.projects.map((project) => (
            <ActionTile
              key={project.id}
              href={`/projects/${project.id}`}
              title={project.name}
              description={project.statusLabel}
              icon={<FolderKanban className="h-4 w-4" />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
