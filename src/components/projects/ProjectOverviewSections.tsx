import { ArrowRight, ExternalLink, GitBranch, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectCommandCenterSnapshot } from '@/lib/projects/overview-command-center';
import type { ProjectOverviewPageData } from '@/lib/projects/service';
import { getRuntimeStatusDotClass } from '@/lib/runtime/status-presentation';

interface ProjectOverviewHeroProps {
  commandCenter: ProjectCommandCenterSnapshot;
  projectStatusLabel: string;
  projectStatus: string | null;
}

export function ProjectOverviewHero({
  commandCenter,
  projectStatusLabel,
  projectStatus,
}: ProjectOverviewHeroProps) {
  return (
    <section className="ui-floating px-5 py-5">
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {commandCenter.title}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{commandCenter.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm" className="h-10 px-4">
              <Link href={commandCenter.primaryAction.href}>
                {commandCenter.primaryAction.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {commandCenter.secondaryAction ? (
              <Button asChild variant="outline" size="sm" className="h-10 px-4">
                <Link href={commandCenter.secondaryAction.href}>
                  {commandCenter.secondaryAction.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="ui-control-muted rounded-[22px] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            当前状态
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm font-medium">
            <span className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(projectStatus)}`} />
            <span>{projectStatusLabel}</span>
          </div>
          {commandCenter.eyebrow ? (
            <div className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {commandCenter.eyebrow}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProjectDefinitionSection({
  project,
  overview,
  services,
  productionEnvironment,
}: {
  project: ProjectOverviewPageData['project'];
  overview: ProjectOverviewPageData['overview'];
  services: ProjectOverviewPageData['serviceCards'];
  productionEnvironment: ProjectOverviewPageData['environmentCards'][number] | null;
}) {
  return (
    <section className="ui-floating overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="text-sm font-semibold">项目摘要</div>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="ui-control-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${getRuntimeStatusDotClass(project.status)}`} />
            <span className="font-medium capitalize">{overview.statusLabel}</span>
          </div>
          <div className="text-muted-foreground">{overview.createdDateLabel}</div>
        </div>

        <div className="space-y-3 text-sm">
          {overview.repository && (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>仓库</span>
              <a
                href={overview.repository.webUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
              >
                {overview.repository.fullName}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            {overview.productionBranch ? (
              <div className="inline-flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="font-mono text-foreground">{overview.productionBranch}</span>
              </div>
            ) : null}
            <div className="inline-flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="text-foreground">{services.length} 个服务</span>
            </div>
            {productionEnvironment ? <span>{productionEnvironment.name} 为正式环境</span> : null}
          </div>

          {productionEnvironment?.primaryDomainUrl ? (
            <a
              href={productionEnvironment.primaryDomainUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
            >
              {productionEnvironment.primaryDomainUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProjectEnvironmentIndex({
  projectId,
  environments,
}: {
  projectId: string;
  environments: ProjectOverviewPageData['environmentCards'];
}) {
  return (
    <section className="ui-floating overflow-hidden">
      <div className="console-divider-bottom px-5 py-4">
        <div className="text-sm font-semibold">环境</div>
      </div>

      <div className="space-y-3 p-3">
        {environments.length === 0 ? (
          <div className="ui-control-muted rounded-[20px] px-5 py-8 text-sm text-muted-foreground">
            还没有环境
          </div>
        ) : (
          environments.map((environment) => (
            <div key={environment.id} className="ui-control rounded-[22px] px-4 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        environment.isPreview
                          ? 'bg-info'
                          : environment.isProduction
                            ? 'bg-success'
                            : 'bg-warning'
                      }`}
                    />
                    <div className="text-sm font-semibold">{environment.name}</div>
                    {environment.latestReleaseCard ? (
                      <Badge variant="outline">
                        {environment.latestReleaseCard.statusDecoration.label}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {[
                      environment.latestReleaseCard
                        ? `当前版本 ${environment.latestReleaseCard.title}`
                        : null,
                      environment.scopeLabel,
                      environment.isProduction && environment.primaryDomainUrl
                        ? environment.primaryDomainUrl.replace(/^https?:\/\//, '')
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') ||
                      environment.previewLifecycle?.stateLabel ||
                      '进入环境'}
                  </div>
                </div>

                <div className="flex shrink-0 items-center xl:justify-end">
                  <Button asChild variant="outline" size="sm" className="h-8 px-3">
                    <Link href={`/projects/${projectId}/environments/${environment.id}`}>打开</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
