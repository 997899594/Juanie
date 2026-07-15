import { NextResponse } from 'next/server';
import { getReleaseById } from '@/lib/releases';
import { isCiAccessError, verifyRepositoryAccess } from '@/lib/releases/api-access';
import { resolveReleaseLifecycle } from '@/lib/releases/lifecycle';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { getReleaseStatusLabel } from '@/lib/releases/status-presentation';

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
      request.headers.get('authorization'),
      {
        projectId: release.projectId,
        repositoryId: release.project?.repository?.id,
        ref: release.sourceRef,
        sha: release.sourceCommitSha,
        externalRunId: release.externalRunId,
      }
    );

    const lifecycle = resolveReleaseLifecycle(release);

    return NextResponse.json({
      success: true,
      release: {
        id: release.id,
        projectId: release.projectId,
        environmentId: release.environmentId,
        status: release.status,
        statusLabel: getReleaseStatusLabel(release.status),
        resolution: lifecycle.resolution,
        terminal: lifecycle.terminal,
        succeeded: lifecycle.succeeded,
        failed: lifecycle.failed,
        error: lifecycle.failureSummary,
        phase: lifecycle.phase,
        issueCode: lifecycle.issue?.code ?? null,
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
    const status = isCiAccessError(error) ? 401 : 400;

    return NextResponse.json(
      {
        error: 'Failed to load release status',
        details: message,
      },
      { status }
    );
  }
}
