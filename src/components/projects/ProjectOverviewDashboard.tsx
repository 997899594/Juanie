import { ProjectEnvironmentIndex } from '@/components/projects/ProjectOverviewSections';
import { PageHeader } from '@/components/ui/page-header';
import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewDashboardProps {
  projectId: string;
  pageData: ProjectOverviewPageData;
}

export function ProjectOverviewDashboard({ projectId, pageData }: ProjectOverviewDashboardProps) {
  const { project, environmentCards } = pageData;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={project.name} />
      <ProjectEnvironmentIndex projectId={projectId} environments={environmentCards} />
    </div>
  );
}
