import {
  ProjectDefinitionSection,
  ProjectEnvironmentIndex,
  ProjectOverviewHero,
} from '@/components/projects/ProjectOverviewSections';
import { PageHeader } from '@/components/ui/page-header';
import { buildProjectCommandCenter } from '@/lib/projects/overview-command-center';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewDashboardProps {
  projectId: string;
  pageData: ProjectOverviewPageData;
}

export function ProjectOverviewDashboard({ projectId, pageData }: ProjectOverviewDashboardProps) {
  const { project, serviceCards, environmentCards } = pageData;
  const commandCenter = buildProjectCommandCenter(projectId, pageData);
  const productionEnvironment =
    environmentCards.find((environment) => environment.isProduction) ?? environmentCards[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={project.name} />

      <ProjectOverviewHero
        commandCenter={commandCenter}
        projectStatus={project.status ?? null}
        projectStatusLabel={pageData.overview.statusLabel}
      />
      <div className="space-y-4">
        <ProjectEnvironmentIndex projectId={projectId} environments={environmentCards} />
        <ProjectDefinitionSection
          projectId={projectId}
          project={project}
          overview={pageData.overview}
          services={serviceCards}
          productionEnvironment={productionEnvironment}
        />
      </div>
    </div>
  );
}
