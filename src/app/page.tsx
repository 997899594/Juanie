import { AlertTriangle, ArrowRight, FolderKanban, Plus, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PreviewSourceSummary } from '@/components/ui/preview-source-summary';
import { auth } from '@/lib/auth';
import { getHomePageData } from '@/lib/home/service';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { headerDescription, stats, projectCards, attentionItems } = await getHomePageData(
    session.user.id,
    session.user.name
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="概览"
        description={headerDescription}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href="/projects">项目</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href="/approvals">审批</Link>
            </Button>
            <Button asChild size="sm" className="h-9 rounded-xl px-4">
              <Link href="/projects/new">
                <Plus className="h-3.5 w-3.5" />
                新建项目
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="console-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">最近项目</div>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl text-xs">
              <Link href="/projects">
                查看全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="p-3">
            {projectCards.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                <div className="mb-4 rounded-2xl bg-secondary p-3">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">还没有项目</div>
                <div className="mt-1 text-sm text-muted-foreground">新建一个项目开始使用</div>
                <Button asChild className="mt-5 rounded-xl">
                  <Link href="/projects/new">
                    <Plus className="h-3.5 w-3.5" />
                    新建项目
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {projectCards.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between rounded-2xl border border-transparent bg-secondary/20 px-4 py-3 transition-colors hover:border-border hover:bg-secondary/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{project.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {project.repositoryLabel}
                        </div>
                        {project.roleLabel && (
                          <div className="mt-2">
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground">
                              {project.roleLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {project.statusLabel}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="console-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">待处理</div>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl text-xs">
              <Link href="/approvals">
                查看全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="p-3">
            {attentionItems.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                <div className="mb-4 rounded-2xl bg-secondary p-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">当前没有待处理项</div>
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((run) => (
                  <Link
                    key={run.id}
                    href={run.href}
                    className="flex items-center justify-between rounded-2xl border border-transparent bg-secondary/20 px-4 py-3 transition-colors hover:border-border hover:bg-secondary/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          run.status === 'awaiting_approval' ? 'bg-warning' : 'bg-destructive'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {run.releaseTitle ?? run.issueLabel ?? run.databaseName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[run.projectName, run.databaseName].join(' · ')}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {run.environmentScopeLabel && (
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                              {run.environmentScopeLabel}
                            </span>
                          )}
                          {run.environmentSourceLabel && (
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                              {run.environmentSourceLabel}
                            </span>
                          )}
                          {run.previewSourceMeta.label && (
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                              {run.previewSourceMeta.label}
                            </span>
                          )}
                          {run.environmentExpiryLabel && (
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                              {run.environmentExpiryLabel}
                            </span>
                          )}
                        </div>
                        {run.platformSignals.primarySummary && (
                          <div className="mt-1 text-sm text-foreground">
                            {run.platformSignals.primarySummary}
                          </div>
                        )}
                        {(run.platformSignals.nextActionLabel || run.actionLabel) && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            下一步：{run.platformSignals.nextActionLabel ?? run.actionLabel}
                          </div>
                        )}
                        {(run.releaseTitle || run.primaryDomainUrl) && (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {run.releaseTitle && <span>{run.releaseTitle}</span>}
                            <PreviewSourceSummary meta={run.previewSourceMeta} />
                            {run.primaryDomainUrl && (
                              <span className="text-foreground underline underline-offset-4">
                                打开环境
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{run.createdAtLabel}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Link
          href="/projects/new"
          className="console-panel flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">新建项目</div>
            <div className="text-xs text-muted-foreground">从模板或仓库开始</div>
          </div>
        </Link>

        <Link
          href="/teams"
          className="console-panel flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">团队管理</div>
            <div className="text-xs text-muted-foreground">成员与权限</div>
          </div>
        </Link>

        <Link
          href="/settings"
          className="console-panel flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">代码托管</div>
            <div className="text-xs text-muted-foreground">GitHub / GitLab</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
