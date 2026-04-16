import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ProjectEnvironmentIndex } from '@/components/projects/ProjectOverviewSections';
import { Button } from '@/components/ui/button';
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
      <PageHeader
        title={project.name}
        actions={
          <Button asChild>
            <Link href={`/projects/${projectId}/environments?new=preview`}>
              <Plus className="h-4 w-4" />
              启动预览环境
            </Link>
          </Button>
        }
      />
      <ProjectEnvironmentIndex projectId={projectId} environments={environmentCards} />
    </div>
  );
}
