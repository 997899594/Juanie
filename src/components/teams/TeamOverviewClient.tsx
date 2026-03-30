'use client';

import { FolderKanban, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { TeamGovernancePanel } from '@/components/teams/TeamGovernancePanel';
import { Button } from '@/components/ui/button';
import type { getTeamOverviewPageData } from '@/lib/teams/service';

interface TeamOverviewClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamOverviewPageData>>>;
}

export function TeamOverviewClient({ teamId, initialData }: TeamOverviewClientProps) {
  const overview = initialData.overview;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {overview.stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="console-panel px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">项目</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {overview.memberSummary} · 从这里进入当前团队的项目主链路。
            </div>
          </div>
          <Link href="/projects/new">
            <Button className="h-9 rounded-xl px-4">
              <Plus className="h-4 w-4" />
              新建项目
            </Button>
          </Link>
        </div>
      </div>

      {overview.projects.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有项目</h2>
          <p className="mt-2 text-sm text-muted-foreground">新建项目后再开始部署</p>
          <Link href="/projects/new" className="mt-5">
            <Button className="rounded-xl">
              <Plus className="h-4 w-4" />
              新建项目
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {overview.projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="console-panel flex items-start gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
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

      <div className="console-panel px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-muted p-3">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">团队成员</div>
            <div className="mt-1 text-xs text-muted-foreground">
              成员与邀请都集中在成员页处理，不在这里重复展开。
            </div>
          </div>
          <Link href={`/teams/${teamId}/members`} className="ml-auto">
            <Button variant="outline" className="h-9 rounded-xl px-4">
              打开成员页
            </Button>
          </Link>
        </div>
      </div>

      <div className="console-panel px-5 py-4">
        <div className="text-sm font-semibold">治理</div>
        <div className="mt-3">
          <TeamGovernancePanel governance={overview.governance} />
        </div>
      </div>
    </div>
  );
}
