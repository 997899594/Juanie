import { and, count, eq } from 'drizzle-orm';
import { FolderKanban, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';

export default async function TeamOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [projectsList, memberCountResult] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projects.teamId, id),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    }),
    db
      .select({ count: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id))),
  ]);

  const memberCount = memberCountResult[0]?.count ?? 0;

  const stats = [
    { label: '项目', value: projectsList.length.toString() },
    { label: '成员', value: memberCount.toString() },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {stats.map((stat) => (
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
          <div className="text-sm font-medium">项目</div>
          <Link href="/projects/new">
            <Button className="h-9 rounded-xl px-4">
              <Plus className="h-4 w-4" />
              新建项目
            </Button>
          </Link>
        </div>
      </div>

      {projectsList.length === 0 ? (
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
          {projectsList.map((project) => (
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
                  {project.status ?? 'active'}
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
            <div className="mt-1 text-xs text-muted-foreground">成员和邀请都在成员页里管理。</div>
          </div>
          <Link href={`/teams/${id}/members`} className="ml-auto">
            <Button variant="outline" className="h-9 rounded-xl px-4">
              打开成员页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
