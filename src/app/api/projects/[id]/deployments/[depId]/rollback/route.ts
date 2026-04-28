import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { getProjectSourceRef } from '@/lib/projects/refs';
import { createProjectRelease } from '@/lib/releases';
import { getProjectDeploymentContextOrThrow } from '@/lib/releases/deployment-access';
import { buildRollbackPlan } from '@/lib/releases/planning';
import { PreviewDatabaseGuardBlockedError } from '@/lib/releases/preview-database-guard';
import { ReleaseSchemaGateBlockedError } from '@/lib/schema-safety';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const { id, depId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const { environment } = await getProjectDeploymentContextOrThrow(id, depId);

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    return NextResponse.json(await buildRollbackPlan({ projectId: id, deploymentId: depId }));
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    if (error instanceof ReleaseSchemaGateBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const { id, depId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const { deployment: targetDeployment, environment } = await getProjectDeploymentContextOrThrow(
      id,
      depId
    );

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        repository: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rollback = await buildRollbackPlan({ projectId: id, deploymentId: depId });

    if (!rollback.plan.canCreate) {
      return NextResponse.json(
        { error: rollback.plan.blockingReason ?? 'Unable to roll back' },
        { status: 400 }
      );
    }

    if (!rollback.sourceDeployment) {
      return NextResponse.json({ error: 'Unable to resolve rollback source' }, { status: 400 });
    }

    const release = await createProjectRelease({
      projectId: id,
      environmentId: targetDeployment.environmentId,
      services: [
        {
          id: targetDeployment.serviceId ?? undefined,
          image: rollback.sourceDeployment.imageUrl,
        },
      ],
      sourceRepository: project.repository?.fullName ?? project.name,
      sourceRef: getProjectSourceRef({ branch: targetDeployment.branch, ...project }),
      sourceCommitSha: targetDeployment.commitSha ?? null,
      configCommitSha: targetDeployment.commitSha ?? null,
      sourceReleaseId: targetDeployment.releaseId ?? null,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      summary: `Rollback to ${targetDeployment.commitSha?.slice(0, 7) ?? 'previous image'}`,
      entryPoint: 'rollback',
    });

    return NextResponse.json(
      {
        success: true,
        releaseId: release?.id,
        imageUrl: targetDeployment.imageUrl,
        plan: rollback.plan,
      },
      { status: 202 }
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    if (
      error instanceof ReleaseSchemaGateBlockedError ||
      error instanceof PreviewDatabaseGuardBlockedError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
