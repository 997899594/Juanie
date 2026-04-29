import { ArrowLeft, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { ReleaseDetailLiveSync } from '@/components/projects/ReleaseDetailLiveSync';
import {
  ReleaseDiffSection,
  ReleaseExecutionSections,
  ReleaseNarrativeSection,
  ReleaseTimelineSection,
  ReleaseTopSummarySection,
} from '@/components/projects/ReleaseDetailSections';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import type { ReleaseTaskCenterSnapshot } from '@/lib/ai/tasks/release-task-center';
import type { TeamRole } from '@/lib/db/schema';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseDetailPageData } from '@/lib/releases/service';

interface ReleaseDetailDashboardProps {
  projectId: string;
  releaseId: string;
  role: TeamRole;
  pageData: NonNullable<Awaited<ReturnType<typeof getReleaseDetailPageData>>>;
  initialTaskCenter?: ReleaseTaskCenterSnapshot | null;
}

export function ReleaseDetailDashboard({
  projectId,
  releaseId,
  role,
  pageData,
  initialTaskCenter,
}: ReleaseDetailDashboardProps) {
  const { release, previousReleaseLink, sourceReleaseLink } = pageData;
  const environmentId = release.environment?.id ?? release.environmentId;
  const environmentLogsHref = `/projects/${projectId}/environments/${environmentId}/logs`;
  const releasesHref = `/projects/${projectId}/environments/${environmentId}/delivery`;
  const releaseStateKey = buildReleaseEventStateKey(release);
  const releaseTitle = getReleaseDisplayTitle(release);

  return (
    <div className="mx-auto max-w-7xl">
      <ReleaseDetailLiveSync
        projectId={projectId}
        releaseId={releaseId}
        initialStatus={release.status}
        initialStateKey={releaseStateKey}
      />
      <div className="space-y-6">
        <PageHeader
          title={releaseTitle}
          description={release.sourceRef}
          eyebrow="发布"
          meta="看这次发生了什么。"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="h-9 px-4">
                <Link href={environmentLogsHref}>
                  <ScrollText className="h-3.5 w-3.5" />
                  日志
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-4">
                <Link href={releasesHref}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回发布
                </Link>
              </Button>
            </div>
          }
        />

        <ReleaseTopSummarySection release={release} />

        <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <ReleaseNarrativeSection release={release} />
          <ReleaseTimelineSection release={release} />
        </section>

        <ReleaseDiffSection
          projectId={projectId}
          sourceReleaseLink={sourceReleaseLink}
          previousReleaseLink={previousReleaseLink}
          release={release}
        />

        <ReleaseExecutionSections
          projectId={projectId}
          releaseId={releaseId}
          role={role}
          release={release}
          initialTaskCenter={initialTaskCenter}
        />
      </div>
    </div>
  );
}
