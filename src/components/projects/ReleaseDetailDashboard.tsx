import { EnvironmentPageFrame } from '@/components/projects/EnvironmentPageFrame';
import { ReleaseDetailLiveSync } from '@/components/projects/ReleaseDetailLiveSync';
import {
  ReleaseExecutionSections,
  ReleaseOverviewDetails,
  ReleaseResultSection,
} from '@/components/projects/ReleaseDetailSections';
import { PageBackAction } from '@/components/ui/page-header';
import type { TeamRole } from '@/lib/db/schema';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseDetailPageData } from '@/lib/releases/service';

interface ReleaseDetailDashboardProps {
  projectId: string;
  releaseId: string;
  role: TeamRole;
  pageData: NonNullable<Awaited<ReturnType<typeof getReleaseDetailPageData>>>;
}

export function ReleaseDetailDashboard({
  projectId,
  releaseId,
  role,
  pageData,
}: ReleaseDetailDashboardProps) {
  const { release, previousReleaseLink, sourceReleaseLink } = pageData;
  const environmentId = release.environment?.id ?? release.environmentId;
  const releasesHref = `/projects/${projectId}/environments/${environmentId}/delivery`;
  const releaseStateKey = buildReleaseEventStateKey(release);
  const releaseTitle = getReleaseDisplayTitle(release);

  return (
    <EnvironmentPageFrame
      projectId={projectId}
      environmentId={environmentId}
      size="wide"
      title={releaseTitle}
      description={release.sourceRef}
      eyebrow="发布"
      beforeHeader={
        <ReleaseDetailLiveSync
          projectId={projectId}
          releaseId={releaseId}
          initialStatus={release.status}
          initialStateKey={releaseStateKey}
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PageBackAction label="返回发布" href={releasesHref} />
        </div>
      }
    >
      <ReleaseResultSection release={release} />

      <ReleaseExecutionSections
        projectId={projectId}
        releaseId={releaseId}
        role={role}
        release={release}
      />

      <ReleaseOverviewDetails
        projectId={projectId}
        sourceReleaseLink={sourceReleaseLink}
        previousReleaseLink={previousReleaseLink}
        release={release}
      />
    </EnvironmentPageFrame>
  );
}
