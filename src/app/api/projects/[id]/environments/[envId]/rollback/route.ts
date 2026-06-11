import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments, projects } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { createProjectRelease } from '@/lib/releases';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { buildEnvironmentRollbackPlan } from '@/lib/releases/planning';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const environment = await db.query.environments.findFirst({
      where: eq(environments.id, envId),
    });

    if (!environment || environment.projectId !== id) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    const url = new URL(request.url);
    const sourceReleaseId = url.searchParams.get('sourceReleaseId');
    const refreshSchemaParam = url.searchParams.get('refreshSchema');
    const requestSchemaRefresh =
      refreshSchemaParam === 'true' || refreshSchemaParam === '1' || refreshSchemaParam === 'yes';

    return NextResponse.json(
      await buildEnvironmentRollbackPlan({
        projectId: id,
        environmentId: envId,
        sourceReleaseId,
        requestSchemaRefresh,
      })
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const body = await request.json().catch(() => ({}));
    const sourceReleaseId =
      typeof body?.sourceReleaseId === 'string' && body.sourceReleaseId.length > 0
        ? body.sourceReleaseId
        : null;

    const [project, environment] = await Promise.all([
      db.query.projects.findFirst({
        where: eq(projects.id, id),
        with: {
          repository: true,
        },
      }),
      db.query.environments.findFirst({
        where: eq(environments.id, envId),
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!environment || environment.projectId !== id) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    const rollback = await buildEnvironmentRollbackPlan({
      projectId: id,
      environmentId: envId,
      sourceReleaseId,
    });

    if (!rollback.sourceRelease || !rollback.plan.canCreate) {
      return NextResponse.json(
        { error: rollback.plan.blockingReason ?? '无法创建回滚发布' },
        { status: 409 }
      );
    }

    const release = await createProjectRelease({
      projectId: id,
      environmentId: envId,
      services: rollback.sourceRelease.artifacts.map((artifact) => ({
        id: artifact.service.id,
        name: artifact.service.name,
        image: artifact.imageUrl,
        digest: artifact.imageDigest,
      })),
      sourceRepository: project.repository?.fullName ?? project.name,
      sourceRef: rollback.sourceRelease.sourceRef,
      sourceCommitSha: rollback.sourceRelease.sourceCommitSha,
      configCommitSha:
        rollback.sourceRelease.configCommitSha ?? rollback.sourceRelease.sourceCommitSha,
      sourceReleaseId: rollback.sourceRelease.id,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      summary: `回滚 ${environment.name} 到 ${
        rollback.sourceRelease.sourceCommitSha?.slice(0, 7) ?? '成功 release'
      }`,
      entryPoint: 'rollback',
    });

    return NextResponse.json(
      {
        success: true,
        releaseId: release?.id,
        releasePath: release?.id ? buildReleaseDetailPath(id, envId, release.id) : null,
        sourceReleaseId: rollback.sourceRelease.id,
        artifactCount: rollback.sourceRelease.artifacts.length,
        plan: rollback.plan,
      },
      { status: 202 }
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
