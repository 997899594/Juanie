import { Settings } from 'lucide-react';
import Link from 'next/link';
import {
  ProjectDefinitionSection,
  ProjectEnvironmentEntrySection,
  ProjectOperationsSection,
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
  const {
    project,
    stats,
    overview,
    environmentCards,
    serviceCards,
    attentionItems,
    recentReleaseCards,
  } = pageData;
  const currentRelease = recentReleaseCards[0] ?? null;
  const primaryAttention = attentionItems[0] ?? null;
  const commandCenter = buildProjectCommandCenter(projectId, pageData);

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
        stats={stats}
        currentRelease={currentRelease}
        primaryAttention={primaryAttention}
        commandCenter={commandCenter}
      />

      <ProjectEnvironmentEntrySection projectId={projectId} environments={environmentCards} />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <ProjectDefinitionSection project={project} overview={overview} services={serviceCards} />
        </div>

        <ProjectOperationsSection
          projectId={projectId}
          attentionItems={attentionItems}
          recentReleaseCards={recentReleaseCards}
        />
      </div>
    </div>
  );
}
