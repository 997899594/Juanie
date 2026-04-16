import { Settings } from 'lucide-react';
import Link from 'next/link';
import {
  ProjectActivitySection,
  ProjectDefinitionSection,
  ProjectEnvironmentIndex,
  ProjectOverviewHero,
} from '@/components/projects/ProjectOverviewSections';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { buildProjectCommandCenter } from '@/lib/projects/overview-command-center';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewDashboardProps {
  projectId: string;
  pageData: ProjectOverviewPageData;
}

export function ProjectOverviewDashboard({ projectId, pageData }: ProjectOverviewDashboardProps) {
  const { project, overview, serviceCards, attentionItems, recentReleaseCards, environmentCards } =
    pageData;
  const commandCenter = buildProjectCommandCenter(projectId, pageData);
  const productionEnvironment =
    environmentCards.find((environment) => environment.isProduction) ?? environmentCards[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={project.name}
        description={overview.headerDescription}
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
            <Link href={`/projects/${projectId}/settings`}>
              <Settings className="h-3.5 w-3.5" />
              设置
            </Link>
          </Button>
        }
      />

      <ProjectOverviewHero
        commandCenter={commandCenter}
        projectStatus={project.status ?? null}
        projectStatusLabel={overview.statusLabel}
      />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <ProjectEnvironmentIndex projectId={projectId} environments={environmentCards} />
          <ProjectDefinitionSection
            project={project}
            overview={overview}
            services={serviceCards}
            productionEnvironment={productionEnvironment}
          />
        </div>

        <ProjectActivitySection
          projectId={projectId}
          attentionItems={attentionItems}
          recentReleaseCards={recentReleaseCards}
        />
      </div>
    </div>
  );
}
