import { ExternalLink, GitBranch, Settings2, Users } from 'lucide-react';
import {
  ProjectAttentionQueue,
  ProjectEnvironmentIndex,
  ProjectOverviewFacts,
  ProjectRecentReleaseSnapshot,
  ProjectRuntimeSnapshot,
} from '@/components/projects/ProjectOverviewSections';
import { PageHeader, PageHeaderAction } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewDashboardProps {
  projectId: string;
  pageData: ProjectOverviewPageData;
  initialCreatePreviewOpen?: boolean;
}

const overviewShellClassName = 'console-panel px-5 py-5';

export function ProjectOverviewDashboard({
  projectId,
  pageData,
  initialCreatePreviewOpen = false,
}: ProjectOverviewDashboardProps) {
  const {
    project,
    environmentCards,
    overview,
    collaboration,
    serviceCards,
    databaseCards,
    domainCards,
    recentReleaseCards,
    attentionItems,
  } = pageData;

  return (
    <PageShell size="content" spacing="tight">
      <PageHeader
        title={project.name}
        description={overview.description ?? undefined}
        meta={overview.headerDescription}
        actions={
          <PageHeaderAction
            label="项目设置"
            href={`/projects/${projectId}/settings`}
            icon={<Settings2 className="h-4 w-4" />}
            variant="ghost"
          />
        }
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <ProjectEnvironmentIndex
          projectId={projectId}
          environments={environmentCards}
          governance={pageData.previewEnvironmentActions}
          initialCreateOpen={initialCreatePreviewOpen}
        />
        <ProjectAttentionQueue projectId={projectId} items={attentionItems} />
      </section>

      <ProjectRecentReleaseSnapshot projectId={projectId} releases={recentReleaseCards} />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ProjectRuntimeSnapshot
          services={serviceCards}
          databases={databaseCards}
          domains={domainCards}
        />
        <div className={overviewShellClassName}>
          <div className="text-sm font-semibold">项目信息</div>
          <div className="mt-4 space-y-3">
            <ProjectOverviewFacts stats={pageData.stats} />
            {overview.statusSummary ? (
              <div className="text-sm text-muted-foreground">{overview.statusSummary}</div>
            ) : null}
            {overview.repository ? (
              <a
                href={overview.repository.webUrl ?? undefined}
                target={overview.repository.webUrl ? '_blank' : undefined}
                rel={overview.repository.webUrl ? 'noreferrer' : undefined}
                className="inline-flex max-w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="truncate">{overview.repository.fullName}</span>
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
                {collaboration.teamName ?? '团队'} · {collaboration.memberCount} 人
              </span>
              <span>创建于 {overview.createdDateLabel}</span>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
