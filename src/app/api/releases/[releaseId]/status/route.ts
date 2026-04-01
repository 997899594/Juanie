import { NextResponse } from 'next/server';
import { getReleaseById } from '@/lib/releases';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';
import { isActiveReleaseStatus } from '@/lib/releases/state-machine';
import { getReleaseStatusLabel } from '@/lib/releases/status-presentation';

function resolveReleaseOutcome(status: string): {
  terminal: boolean;
  succeeded: boolean;
  failed: boolean;
} {
  const terminal = !isActiveReleaseStatus(status);
  const succeeded = status === 'succeeded';
  const failed = terminal && !succeeded;

  return { terminal, succeeded, failed };
}

function resolveReleaseErrorMessage(
  release: Awaited<ReturnType<typeof getReleaseById>>
): string | null {
  if (!release) {
    return null;
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

  if (release.status === 'degraded') {
    return 'Release completed in degraded state';
  }

  if (release.status === 'canceled') {
    return 'Release was canceled';
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
        releasePath: `/projects/${release.projectId}/releases/${release.id}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('Token does not have access') ? 401 : 400;

    return NextResponse.json(
      {
        error: 'Failed to load release status',
        details: message,
      },
      { status }
    );
  }
}
