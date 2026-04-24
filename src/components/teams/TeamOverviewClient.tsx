'use client';

import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useProjectsRealtime } from '@/hooks/useProjectsRealtime';
import type { getTeamOverviewPageData } from '@/lib/teams/service';

interface TeamOverviewClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamOverviewPageData>>>;
}

export function TeamOverviewClient({ teamId, initialData }: TeamOverviewClientProps) {
  const [overview, setOverview] = useState(initialData.overview);
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';

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
          <div key={stat.label} className={`${shellClassName} px-5 py-4`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
        <div className="flex items-stretch gap-2 md:justify-end">
          <Link href={`/teams/${teamId}/members`} className="flex-1 md:flex-none">
            <Button variant="ghost" className="h-full min-h-16 w-full rounded-[20px] px-5">
              成员
            </Button>
          </Link>
          <Link href="/projects/new" className="flex-1 md:flex-none">
            <Button className="h-full min-h-16 w-full rounded-[20px] px-5">
              <Plus className="h-4 w-4" />
              新建项目
            </Button>
          </Link>
        </div>
      </div>

      {overview.projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8 text-muted-foreground" />}
          title="没有项目"
          action={{ label: '新建项目', href: '/projects/new' }}
          className="min-h-80"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {overview.projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={`${shellClassName} flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/90`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-secondary/80">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{project.name}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {[project.statusLabel, project.governance.roleLabel].filter(Boolean).join(' · ')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
