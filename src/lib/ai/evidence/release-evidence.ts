import { loadAIReleaseContext } from '@/lib/ai/evidence/load-release-context';
import { isPreviewEnvironment, isProductionEnvironment } from '@/lib/environments/model';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';

export interface ReleaseEvidencePack {
  releaseId: string;
  projectId: string;
  teamId: string;
  environmentId: string;
  environmentName: string;
  releaseStatus: string;
  displayTitle: string;
  sourceRef: string | null;
  sourceCommitSha: string | null;
  deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  databaseStrategy: 'direct' | 'inherit' | 'isolated_clone' | null;
  isProduction: boolean;
  isPreview: boolean;
  artifactCount: number;
  migrationCount: number;
  changedServices: string[];
  hasBreakingMigration: boolean;
  awaitingApproval: boolean;
  issueSummary: string | null;
  nextAction: string | null;
  capacitySummary: string | null;
  timeline: Array<{
    at: string | null;
    type: 'release' | 'migration' | 'deployment' | 'incident' | 'governance';
    title: string;
    summary: string;
    tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  }>;
}

export async function buildReleaseEvidencePack(input: {
  releaseId: string;
  projectId: string;
}): Promise<ReleaseEvidencePack> {
  const { decoratedRelease } = await loadAIReleaseContext(input);
  const changedServices =
    decoratedRelease.diff.changedArtifacts.length > 0
      ? decoratedRelease.diff.changedArtifacts.map((item) => item.serviceName)
      : decoratedRelease.artifacts.map((artifact) => artifact.service.name);
  const uniqueChangedServices = Array.from(new Set(changedServices));
  const capacity = decoratedRelease.infrastructureDiagnostics?.capacity ?? null;

  return {
    releaseId: decoratedRelease.id,
    projectId: decoratedRelease.projectId,
    teamId: decoratedRelease.project.teamId,
    environmentId: decoratedRelease.environmentId,
    environmentName: decoratedRelease.environment.name,
    releaseStatus: decoratedRelease.status,
    displayTitle: getReleaseDisplayTitle(decoratedRelease),
    sourceRef: decoratedRelease.sourceRef,
    sourceCommitSha: decoratedRelease.sourceCommitSha,
    deploymentStrategy: decoratedRelease.environment.deploymentStrategy,
    databaseStrategy: decoratedRelease.environment.databaseStrategy,
    isProduction: isProductionEnvironment(decoratedRelease.environment),
    isPreview: isPreviewEnvironment(decoratedRelease.environment),
    artifactCount: decoratedRelease.artifacts.length,
    migrationCount: decoratedRelease.migrationRuns.length,
    changedServices: uniqueChangedServices,
    hasBreakingMigration: decoratedRelease.migrationRuns.some(
      (run) => run.specification?.compatibility === 'breaking'
    ),
    awaitingApproval: decoratedRelease.approvalRunsCount > 0,
    issueSummary:
      decoratedRelease.platformSignals.primarySummary ??
      decoratedRelease.intelligence.issue?.summary ??
      null,
    nextAction:
      decoratedRelease.platformSignals.nextActionLabel ??
      decoratedRelease.intelligence.issue?.nextActionLabel ??
      decoratedRelease.intelligence.actionLabel ??
      null,
    capacitySummary: capacity
      ? `集群已请求 ${capacity.requestedMemoryLabel} 内存，剩余 ${capacity.availableMemoryLabel}，本次预计额外占用 ${capacity.estimatedRolloutDeltaMemoryLabel}`
      : null,
    timeline: decoratedRelease.timeline.map((item) => ({
      at: item.at,
      type: item.type,
      title: item.title,
      summary: item.description,
      tone: item.tone,
    })),
  };
}
