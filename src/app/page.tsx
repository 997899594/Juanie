import { AlertTriangle, ArrowRight, FolderKanban, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PriorityDeck, type PriorityDeckItem } from '@/components/ui/priority-deck';
import { auth } from '@/lib/auth';
import { getHomePageData } from '@/lib/home/service';
import { getStatusDotClass } from '@/lib/releases/status-presentation';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { commandCenter, projectCards, attentionItems } = await getHomePageData(
    session.user.id,
    session.user.name
  );
  const nextPriorityItems: PriorityDeckItem[] = [
    {
      key: 'primary',
      title: commandCenter.primaryAction.label,
      href: commandCenter.primaryAction.href,
      actionLabel: '进入',
      tone: 'default',
    },
  ];

  if (commandCenter.focusItems[0]) {
    nextPriorityItems.push({
      key: 'queue',
      title: commandCenter.focusItems[0].title,
      href: commandCenter.focusItems[0].href,
      actionLabel: commandCenter.focusItems[0].meta,
      tone: commandCenter.focusItems[0].tone === 'danger' ? 'danger' : 'warning',
    });
  }

  if (projectCards[0]) {
    nextPriorityItems.push({
      key: 'project',
      title: projectCards[0].name,
      href: `/projects/${projectCards[0].id}`,
      actionLabel: '进入',
      tone: 'success',
    });
  } else {
    nextPriorityItems.push({
      key: 'project-empty',
      title: '创建项目',
      href: '/projects/new',
      actionLabel: '新建项目',
      tone: 'success',
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="指挥台"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href="/projects">项目</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href="/inbox">待办</Link>
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

      <PriorityDeck title="下一步" items={nextPriorityItems} />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="console-panel overflow-hidden">
          <div className="console-divider-bottom flex items-center justify-between px-5 py-4">
            <div className="text-sm font-semibold">项目入口</div>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl text-xs">
              <Link href="/projects">
                全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="p-3">
            {projectCards.length === 0 ? (
              <div className="console-surface flex min-h-64 flex-col items-center justify-center rounded-2xl p-6 text-center">
                <div className="mb-4 rounded-2xl bg-secondary p-3">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">没有项目</div>
                <Button asChild className="mt-5 rounded-xl">
                  <Link href="/projects/new">
                    <Plus className="h-3.5 w-3.5" />
                    新建项目
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {projectCards.slice(0, 3).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="console-surface flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-secondary/50"
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
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {[project.roleLabel, project.statusLabel].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="console-panel overflow-hidden">
          <div className="console-divider-bottom flex items-center justify-between px-5 py-4">
            <div className="text-sm font-semibold">待处理详情</div>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl text-xs">
              <Link href="/inbox">
                全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="p-3">
            {attentionItems.length === 0 ? (
              <div className="console-surface flex min-h-64 flex-col items-center justify-center rounded-2xl p-6 text-center">
                <div className="mb-4 rounded-2xl bg-secondary p-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">没有待处理项</div>
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.slice(0, 3).map((run) => (
                  <Link
                    key={run.id}
                    href={run.href}
                    className="console-surface flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${getStatusDotClass(run.status, 'migration')}`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {run.releaseTitle ?? run.issueLabel ?? run.databaseName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[run.projectName, run.databaseName].join(' · ')}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {[
                            run.environmentScopeLabel,
                            run.environmentSourceLabel,
                            run.previewSourceMeta.label,
                            run.environmentExpiryLabel,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {run.platformSignals.primarySummary && (
                          <div className="mt-1 text-sm text-foreground">
                            {run.platformSignals.primarySummary}
                          </div>
                        )}
                        {(run.platformSignals.nextActionLabel || run.actionLabel) && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {run.platformSignals.nextActionLabel ?? run.actionLabel}
                          </div>
                        )}
                        {(run.releaseTitle || run.primaryDomainUrl) && (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {run.releaseTitle && <span>{run.releaseTitle}</span>}
                            {run.primaryDomainUrl && (
                              <span className="text-foreground underline underline-offset-4">
                                环境
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Link
          href="/projects/new"
          className="console-panel flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">新建项目</div>
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
      </div>
    </div>
  );
}
