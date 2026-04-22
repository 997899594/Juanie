import { ExternalLink, GitBranch, Plus, Settings2, Users } from 'lucide-react';
import Link from 'next/link';
import { ProjectEnvironmentIndex } from '@/components/projects/ProjectOverviewSections';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewDashboardProps {
  projectId: string;
  pageData: ProjectOverviewPageData;
}

const overviewShellClassName =
  'rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';

export function ProjectOverviewDashboard({ projectId, pageData }: ProjectOverviewDashboardProps) {
  const { project, environmentCards, overview, collaboration } = pageData;
  const productionEnvironment = environmentCards.find((environment) => environment.isProduction);
  const productionHost =
    productionEnvironment?.primaryDomainUrl?.replace(/^https?:\/\//, '') ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={project.name}
        description={overview.description ?? undefined}
        meta={overview.headerDescription}
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

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={overviewShellClassName}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">项目</div>
          <div className="mt-3 space-y-3">
            <div className="text-sm text-foreground">{collaboration.teamName ?? '团队项目'}</div>
            {overview.repository ? (
              <a
                href={overview.repository.webUrl ?? undefined}
                target={overview.repository.webUrl ? '_blank' : undefined}
                rel={overview.repository.webUrl ? 'noreferrer' : undefined}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>{overview.repository.fullName}</span>
                {overview.repository.webUrl ? <ExternalLink className="h-3.5 w-3.5" /> : null}
              </a>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {overview.productionBranch ? (
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  {overview.productionBranch}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {collaboration.memberCount} 人
              </span>
              <span>创建于 {overview.createdDateLabel}</span>
            </div>
          </div>
        </div>

        <div className={overviewShellClassName}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            正式入口
          </div>
          <div className="mt-3 space-y-3">
            <div className="text-sm text-foreground">
              {productionHost ?? '生产环境还没有访问地址'}
            </div>
            <div className="flex flex-wrap gap-2">
              {productionEnvironment?.primaryDomainUrl ? (
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
                  <a href={productionEnvironment.primaryDomainUrl} target="_blank" rel="noreferrer">
                    打开正式环境
                  </a>
                </Button>
              ) : null}
              {productionEnvironment ? (
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
                  <Link href={`/projects/${projectId}/environments/${productionEnvironment.id}`}>
                    进入正式环境
                  </Link>
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
