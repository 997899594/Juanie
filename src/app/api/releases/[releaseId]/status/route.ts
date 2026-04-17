import { NextResponse } from 'next/server';
import { getReleaseById } from '@/lib/releases';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { isActiveReleaseStatus } from '@/lib/releases/state-machine';
import { getReleaseStatusLabel } from '@/lib/releases/status-presentation';

function resolveReleaseOutcome(status: string): {
  resolution: 'running' | 'succeeded' | 'failed' | 'action_required';
  terminal: boolean;
  succeeded: boolean;
  failed: boolean;
} {
  if (
    status === 'awaiting_approval' ||
    status === 'awaiting_external_completion' ||
    status === 'awaiting_rollout'
  ) {
    return {
      resolution: 'action_required',
      terminal: true,
      succeeded: false,
      failed: false,
    };
  }

  const terminal = !isActiveReleaseStatus(status);
  const succeeded = status === 'succeeded';
  const failed = terminal && !succeeded;
  const resolution = succeeded ? 'succeeded' : failed ? 'failed' : 'running';

  return { resolution, terminal, succeeded, failed };
}

function resolveReleaseErrorMessage(
  release: Awaited<ReturnType<typeof getReleaseById>>
): string | null {
  if (!release) {
    return null;
  }

  const approvalRun = release.migrationRuns.find((run) => run.status === 'awaiting_approval');
  if (approvalRun) {
    const targetName = approvalRun.service?.name ?? approvalRun.database?.name ?? approvalRun.id;
    return `Migration ${targetName} is awaiting approval`;
  }

  const externalRun = release.migrationRuns.find(
    (run) => run.status === 'awaiting_external_completion'
  );
  if (externalRun) {
    const targetName = externalRun.service?.name ?? externalRun.database?.name ?? externalRun.id;
    return `Migration ${targetName} is awaiting external completion`;
  }

  const rolloutDeployment = release.deployments.find(
    (deployment) => deployment.status === 'awaiting_rollout'
  );
  if (rolloutDeployment) {
    const targetName = rolloutDeployment.serviceId ?? rolloutDeployment.id;
    return `Deployment ${targetName} is awaiting rollout`;
  }

  if (release.errorMessage) {
    return release.errorMessage;
  }

  const failedMigration = release.migrationRuns.find((run) => run.status === 'failed');
  if (failedMigration) {
    const targetName =
      failedMigration.service?.name ?? failedMigration.database?.name ?? failedMigration.id;
    return `Migration ${targetName} failed`;
  }

  const failedDeployment = release.deployments.find((deployment) =>
    ['failed', 'rolled_back', 'verification_failed'].includes(deployment.status)
  );
  if (failedDeployment) {
    return (
      failedDeployment.errorMessage ??
      `Deployment ${failedDeployment.id} ended with status ${failedDeployment.status}`
    );
  }

  const canceledDeployment = release.deployments.find(
    (deployment) => deployment.status === 'canceled'
  );
  if (canceledDeployment) {
    if (canceledDeployment.errorMessage?.includes('Superseded by deployment')) {
      return 'Release was superseded by a newer deployment';
    }

    return canceledDeployment.errorMessage ?? 'Release was canceled';
  }

  if (release.status === 'degraded') {
    return 'Release completed in degraded state';
  }

  if (release.status === 'canceled') {
    if (release.errorMessage?.includes('Superseded by deployment')) {
      return 'Release was superseded by a newer deployment';
    }

    return release.errorMessage ?? 'Release was canceled';
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  try {
    const { releaseId } = await params;
    const release = await getReleaseById(releaseId);

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    await verifyRepositoryAccess(
      release.project?.repository?.fullName ?? release.sourceRepository ?? '',
      request.headers.get('authorization')
    );

    const outcome = resolveReleaseOutcome(release.status);

    return NextResponse.json({
      success: true,
      release: {
        id: release.id,
        projectId: release.projectId,
        environmentId: release.environmentId,
        status: release.status,
        statusLabel: getReleaseStatusLabel(release.status),
        resolution: outcome.resolution,
        terminal: outcome.terminal,
        succeeded: outcome.succeeded,
        failed: outcome.failed,
        error: resolveReleaseErrorMessage(release),
        summary: release.summary,
        sourceRepository: release.sourceRepository,
        sourceRef: release.sourceRef,
        sourceCommitSha: release.sourceCommitSha,
        createdAt: release.createdAt,
        updatedAt: release.updatedAt,
        releasePath: buildReleaseDetailPath(release.projectId, release.environmentId, release.id),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message.includes('Token does not have access') || message.includes('Missing bearer token')
        ? 401
        : 400;

    return NextResponse.json(
      {
        error: 'Failed to load release status',
        details: message,
      },
      { status }
    );
  }
}
