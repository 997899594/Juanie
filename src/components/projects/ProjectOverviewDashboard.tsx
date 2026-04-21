import { ExternalLink, GitBranch, Plus, Settings2, Users } from 'lucide-react';
import Link from 'next/link';
import { ProjectEnvironmentIndex } from '@/components/projects/ProjectOverviewSections';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return email.slice(0, 2).toUpperCase();
}

interface ProjectOverviewDashboardProps {
  projectId: string;
  pageData: ProjectOverviewPageData;
}

export function ProjectOverviewDashboard({ projectId, pageData }: ProjectOverviewDashboardProps) {
  const { project, environmentCards, overview, collaboration } = pageData;
  const productionEnvironment = environmentCards.find((environment) => environment.isProduction);
  const productionHost =
    productionEnvironment?.primaryDomainUrl?.replace(/^https?:\/\//, '') ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={project.name}
        description={overview.description ?? overview.headerDescription}
        actions={
          <>
            {productionEnvironment ? (
              <Button asChild variant="ghost">
                <Link
                  href={`/projects/${projectId}/environments/${productionEnvironment.id}/delivery`}
                >
                  正式环境
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href={`/projects/${projectId}/settings`}>
                <Settings2 className="h-4 w-4" />
                项目设置
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/projects/${projectId}/environments?new=preview`}>
                <Plus className="h-4 w-4" />
                启动预览环境
              </Link>
            </Button>
          </>
        }
      />

      <section className="ui-floating overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.25fr_0.75fr_1fr]">
          <div className="console-divider-bottom px-5 py-4 md:console-divider-bottom-0 md:console-divider-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              项目
            </div>
            <div className="mt-3 space-y-2 text-sm text-foreground">
              <div>{collaboration.teamName ?? '团队项目'}</div>
              {overview.repository ? (
                <a
                  href={overview.repository.webUrl ?? undefined}
                  target={overview.repository.webUrl ? '_blank' : undefined}
                  rel={overview.repository.webUrl ? 'noreferrer' : undefined}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{overview.repository.fullName}</span>
                  {overview.repository.webUrl ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                </a>
              ) : null}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {overview.productionBranch ? (
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    {overview.productionBranch}
                  </span>
                ) : null}
                <span>创建于 {overview.createdDateLabel}</span>
              </div>
            </div>
          </div>

          <div className="console-divider-bottom px-5 py-4 md:console-divider-bottom-0 md:console-divider-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              团队
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex -space-x-2">
                {collaboration.members.map((member) => (
                  <Avatar
                    key={member.id}
                    className="h-9 w-9 rounded-xl shadow-[0_10px_22px_rgba(55,53,47,0.08)]"
                  >
                    <AvatarImage src={member.user.image ?? undefined} />
                    <AvatarFallback className="rounded-xl bg-secondary text-[10px] font-semibold">
                      {getInitials(member.user.name, member.user.email)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-sm text-foreground">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {collaboration.memberCount} 人
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              正式入口
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-sm text-foreground">
                {productionHost ?? '生产环境还没有访问地址'}
              </div>
              {productionEnvironment?.primaryDomainUrl ? (
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
                  <a href={productionEnvironment.primaryDomainUrl} target="_blank" rel="noreferrer">
                    打开正式环境
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <ProjectEnvironmentIndex projectId={projectId} environments={environmentCards} />
    </div>
  );
}
