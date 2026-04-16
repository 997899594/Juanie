import { ArrowLeft, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { ReleaseDetailLiveSync } from '@/components/projects/ReleaseDetailLiveSync';
import {
  ReleaseDiffSection,
  ReleaseExecutionSections,
  ReleaseMobileActions,
  ReleaseNarrativeSection,
  ReleaseTimelineSection,
  ReleaseTopSummarySection,
} from '@/components/projects/ReleaseDetailSections';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import type { TeamRole } from '@/lib/db/schema';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseDetailPageData } from '@/lib/releases/service';

interface ReleaseDetailDashboardProps {
  projectId: string;
  releaseId: string;
  role: TeamRole;
  pageData: NonNullable<Awaited<ReturnType<typeof getReleaseDetailPageData>>>;
  releasePlanSnapshot: Awaited<ReturnType<typeof resolveAIPluginSnapshot<ReleasePlan>>>;
  incidentSnapshot: Awaited<ReturnType<typeof resolveAIPluginSnapshot<IncidentAnalysis>>>;
}

export function ReleaseDetailDashboard({
  projectId,
  releaseId,
  role,
  pageData,
  releasePlanSnapshot,
  incidentSnapshot,
}: ReleaseDetailDashboardProps) {
  const { release, previousReleaseLink } = pageData;
  const environmentId = release.environment?.id ?? release.environmentId;
  const environmentLogsHref = `/projects/${projectId}/environments/${environmentId}/logs`;
  const environmentDetailHref = `/projects/${projectId}/environments/${environmentId}`;
  const environmentDiagnosticsHref = `/projects/${projectId}/environments/${environmentId}/diagnostics`;
  const releasesHref = `/projects/${projectId}/delivery`;
  const releaseStateKey = buildReleaseEventStateKey(release);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ReleaseDetailLiveSync
        projectId={projectId}
        releaseId={releaseId}
        initialStatus={release.status}
        initialStateKey={releaseStateKey}
      />
      <PageHeader
        title={getReleaseDisplayTitle(release)}
        description={release.sourceRef}
        eyebrow="发布"
        meta="看这次发生了什么。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="h-9 rounded-xl px-4">
              <Link href={environmentLogsHref}>
                <ScrollText className="h-3.5 w-3.5" />
                日志
              </Link>
            </Button>
            {release.primaryDomainUrl && (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
                <a href={release.primaryDomainUrl} target="_blank" rel="noreferrer">
                  环境
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href={releasesHref}>
                <ArrowLeft className="h-3.5 w-3.5" />
                返回
              </Link>
            </Button>
          </div>
        }
      />

      <ReleaseTopSummarySection release={release} />

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <ReleaseNarrativeSection
          release={release}
          environmentLogsHref={environmentLogsHref}
          environmentDetailHref={environmentDetailHref}
          releasesHref={releasesHref}
        />
        <ReleaseTimelineSection
          release={release}
          environmentLogsHref={environmentLogsHref}
          environmentDiagnosticsHref={environmentDiagnosticsHref}
        />
      </section>

      <ReleaseDiffSection
        projectId={projectId}
        previousReleaseLink={previousReleaseLink}
        release={release}
      />

      <ReleaseExecutionSections
        projectId={projectId}
        releaseId={releaseId}
        role={role}
        release={release}
        releasePlanSnapshot={releasePlanSnapshot}
        incidentSnapshot={incidentSnapshot}
      />

      <ReleaseMobileActions
        environmentLogsHref={environmentLogsHref}
        environmentDetailHref={environmentDetailHref}
        releasesHref={releasesHref}
      />
    </div>
  );
}
