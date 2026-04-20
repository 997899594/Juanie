'use client';

import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useProjectsRealtime } from '@/hooks/useProjectsRealtime';
import type { ProjectListCard, ProjectListStat } from '@/lib/projects/list-view';
import {
  formatRuntimeStatusLabel,
  getRuntimeStatusDotClass,
} from '@/lib/runtime/status-presentation';

interface ProjectsPageClientProps {
  initialProjectCards: ProjectListCard[];
  initialStats: ProjectListStat[];
}

export function ProjectsPageClient({ initialProjectCards, initialStats }: ProjectsPageClientProps) {
  const [projectCards, setProjectCards] = useState(initialProjectCards);
  const stats = initialStats.map((stat) =>
    stat.label === '项目' ? { ...stat, value: projectCards.length } : stat
  );
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';

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
                statusLabel: formatRuntimeStatusLabel(event.project.status),
              }
            : project
        )
      );
    },
  });

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

      <div className="grid gap-2 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`${shellClassName} px-4 py-3`}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      {projectCards.length === 0 ? (
        <div
          className={`${shellClassName} flex min-h-80 flex-col items-center justify-center text-center`}
        >
          <div className="mb-4 rounded-[18px] bg-secondary/80 p-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">没有项目</h2>
          <Button asChild variant="outline" className="mt-5 rounded-full">
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
                    {[project.roleLabel, project.createdAtLabel].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="rounded-full bg-white/82 px-3 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
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
    </div>
  );
}
