import { Settings } from 'lucide-react';
import Link from 'next/link';
import {
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
  const { project, serviceCards, environmentCards } = pageData;
  const commandCenter = buildProjectCommandCenter(projectId, pageData);
  const productionEnvironment =
    environmentCards.find((environment) => environment.isProduction) ?? environmentCards[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={project.name}
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
        projectStatusLabel={pageData.overview.statusLabel}
      />
      <div className="space-y-4">
        <ProjectEnvironmentIndex projectId={projectId} environments={environmentCards} />
        <ProjectDefinitionSection
          project={project}
          overview={pageData.overview}
          services={serviceCards}
          productionEnvironment={productionEnvironment}
        />
      </div>
    </div>
  );
}
