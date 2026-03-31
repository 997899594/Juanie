import { loadAIReleaseContext } from '@/lib/ai/evidence/load-release-context';

export interface IncidentEvidencePack {
  releaseId: string;
  projectId: string;
  teamId: string;
  environmentId: string;
  environmentName: string;
  releaseStatus: string;
  errorMessage: string | null;
  issueSummary: string | null;
  primaryIssue: string | null;
  timeline: Array<{
    at: string | null;
    type: 'release' | 'migration' | 'deployment' | 'incident' | 'governance';
    title: string;
    summary: string;
    tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  }>;
  safeActions: Array<'cleanup_terminating_pods' | 'restart_deployments'>;
}

function inferTimelineType(key: string): IncidentEvidencePack['timeline'][number]['type'] {
  if (key.startsWith('migration-')) {
    return 'migration';
  }

  if (key.startsWith('deployment-') || key === 'rollout-ready' || key === 'preview-ready') {
    return 'deployment';
  }

  if (key.startsWith('event:')) {
    return 'incident';
  }

  if (key.startsWith('governance:')) {
    return 'governance';
  }

  return 'release';
}

export async function buildIncidentEvidencePack(input: {
  releaseId: string;
  projectId: string;
}): Promise<IncidentEvidencePack> {
  const { decoratedRelease } = await loadAIReleaseContext(input);
  const primaryIssueCode = decoratedRelease.infrastructureDiagnostics?.primaryIssue?.code ?? null;
  const safeActions: IncidentEvidencePack['safeActions'] = [];

  if (
    primaryIssueCode === 'stuck_terminating_pods' ||
    primaryIssueCode === 'capacity_blocked' ||
    (decoratedRelease.infrastructureDiagnostics?.abnormalResources.clusterTerminatingPods.count ??
      0) > 0
  ) {
    safeActions.push('cleanup_terminating_pods');
  }

  if (
    primaryIssueCode === 'runtime_unhealthy' ||
    primaryIssueCode === 'probe_failed' ||
    primaryIssueCode === 'rollout_deadline_exceeded' ||
    decoratedRelease.deployments.some((deployment) => deployment.status === 'failed')
  ) {
    safeActions.push('restart_deployments');
  }

  return {
    releaseId: decoratedRelease.id,
    projectId: decoratedRelease.projectId,
    teamId: decoratedRelease.project.teamId,
    environmentId: decoratedRelease.environmentId,
    environmentName: decoratedRelease.environment.name,
    releaseStatus: decoratedRelease.status,
    errorMessage:
      decoratedRelease.errorMessage ?? decoratedRelease.intelligence.failureSummary ?? null,
    issueSummary:
      decoratedRelease.platformSignals.primarySummary ??
      decoratedRelease.narrativeSummary.risk ??
      null,
    primaryIssue:
      decoratedRelease.infrastructureDiagnostics?.primaryIssue?.summary ??
      decoratedRelease.blockingReason?.summary ??
      decoratedRelease.intelligence.issue?.summary ??
      null,
    timeline: decoratedRelease.timeline.map((item) => ({
      at: item.at,
      type: inferTimelineType(item.key),
      title: item.title,
      summary: item.description,
      tone: item.tone,
    })),
    safeActions,
  };
}
