import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectWithRepositoryAccessOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments, promotionFlows } from '@/lib/db/schema';
import { isPromoteOnlyEnvironment } from '@/lib/environments/model';
import { resolvePromotionFlow } from '@/lib/environments/promotion';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { getProjectProductionRef } from '@/lib/projects/refs';
import { createProjectRelease } from '@/lib/releases';
import { getDeployableReleaseArtifacts, getReleaseArtifactUri } from '@/lib/releases/artifacts';
import { buildReleaseEnvironmentTagName } from '@/lib/releases/environment-tracking';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import {
  buildPromotionPlan,
  resolveDuplicatePromotion,
  resolvePromotableSourceRelease,
} from '@/lib/releases/planning';
import { PreviewDatabaseGuardBlockedError } from '@/lib/releases/preview-database-guard';
import { ReleaseSchemaGateBlockedError } from '@/lib/schema-safety';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);

    const url = new URL(request.url);
    const flowId = url.searchParams.get('flowId');
    const refreshSchemaParam = url.searchParams.get('refreshSchema');
    const requestSchemaRefresh =
      refreshSchemaParam === 'true' || refreshSchemaParam === '1' || refreshSchemaParam === 'yes';
    const promotion = await buildPromotionPlan(id, {
      flowId,
      schemaGateMode: 'stored',
      requestSchemaRefresh,
    });

    if (!promotion.targetEnvironment && flowId) {
      return NextResponse.json(
        { error: promotion.plan.blockingReason ?? '未找到对应的提升链路' },
        { status: 404 }
      );
    }

    if (
      promotion.targetEnvironment &&
      !canManageEnvironment(member.role, promotion.targetEnvironment)
    ) {
      return NextResponse.json(
        { error: getEnvironmentGuardReason(promotion.targetEnvironment) },
        { status: 403 }
      );
    }

    return NextResponse.json(promotion);
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project, member } = await getProjectWithRepositoryAccessOrThrow(id, session.user.id);
    const body = await request.json().catch(() => ({}));
    const flowId = typeof body?.flowId === 'string' ? body.flowId : undefined;

    const [envList, flowList] = await Promise.all([
      db.query.environments.findMany({
        where: eq(environments.projectId, id),
      }),
      db.query.promotionFlows.findMany({
        where: eq(promotionFlows.projectId, id),
      }),
    ]);
    const promotion = resolvePromotionFlow({
      environments: envList,
      promotionFlows: flowList,
      flowId,
    });

    if (!promotion.sourceEnvironment) {
      return NextResponse.json(
        { error: flowId ? '未找到对应的提升链路' : '没有可用的提升来源环境' },
        { status: flowId ? 404 : 400 }
      );
    }
    if (!promotion.targetEnvironment) {
      return NextResponse.json(
        { error: flowId ? '未找到对应的提升链路' : '没有可用的提升目标环境' },
        { status: flowId ? 404 : 400 }
      );
    }
    if (!canManageEnvironment(member.role, promotion.targetEnvironment)) {
      return NextResponse.json(
        { error: getEnvironmentGuardReason(promotion.targetEnvironment) },
        { status: 403 }
      );
    }
    const targetEnvironment = await db.query.environments.findFirst({
      where: eq(environments.id, promotion.targetEnvironment.id),
    });
    const targetNamespace = targetEnvironment?.namespace ?? null;

    if (!targetNamespace) {
      return NextResponse.json(
        { error: `${promotion.targetEnvironment.name} 环境命名空间尚未准备完成` },
        { status: 400 }
      );
    }

    const promotionSource = await resolvePromotableSourceRelease({
      projectId: id,
      sourceEnvironment: promotion.sourceEnvironment,
    });

    if (!promotionSource.sourceRelease) {
      return NextResponse.json(
        {
          error:
            promotionSource.blockingReason ??
            `${promotion.sourceEnvironment.name} 来源发布缺少可复用制品，请先重新发布`,
        },
        { status: 409 }
      );
    }

    const { sourceRelease, sourceArtifacts } = promotionSource;
    const duplicatePromotion = await resolveDuplicatePromotion({
      projectId: id,
      targetEnvironmentId: promotion.targetEnvironment.id,
      targetEnvironmentName: promotion.targetEnvironment.name,
      sourceEnvironmentName: promotion.sourceEnvironment.name,
      sourceReleaseId: sourceRelease.id,
      sourceCommitSha: sourceRelease.sourceCommitSha,
    });

    if (duplicatePromotion.blockingReason) {
      return NextResponse.json({ error: duplicatePromotion.blockingReason }, { status: 409 });
    }

    const promotedRelease = await createProjectRelease({
      projectId: id,
      environmentId: promotion.targetEnvironment.id,
      services: sourceArtifacts.map((artifact) => ({
        id: artifact.serviceId ?? undefined,
        name: artifact.service?.name,
        image: getReleaseArtifactUri(artifact) ?? '',
        digest: artifact.imageDigest,
      })),
      sourceRepository: project.repository?.fullName ?? project.name,
      sourceRef: sourceRelease.sourceRef ?? getProjectProductionRef(project),
      sourceCommitSha: sourceRelease.sourceCommitSha,
      configCommitSha: sourceRelease.configCommitSha,
      sourceReleaseId: sourceRelease.id,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      summary: `提升 ${sourceRelease.sourceCommitSha?.slice(0, 7) ?? 'release'} 到 ${promotion.targetEnvironment.name}`,
      entryPoint: 'promotion',
    });
    const tagName =
      promotedRelease?.environment && isPromoteOnlyEnvironment(promotedRelease.environment)
        ? buildReleaseEnvironmentTagName({
            environmentName: promotedRelease.environment.name,
            createdAt: promotedRelease.createdAt,
            sourceCommitSha: promotedRelease.sourceCommitSha,
          })
        : null;
    const promotedReleaseEnvironmentId =
      promotedRelease?.environmentId ?? promotion.targetEnvironment.id;

    return NextResponse.json(
      {
        success: true,
        releaseId: promotedRelease?.id,
        releasePath: promotedRelease?.id
          ? buildReleaseDetailPath(id, promotedReleaseEnvironmentId, promotedRelease.id)
          : null,
        artifacts: promotedRelease
          ? getDeployableReleaseArtifacts(promotedRelease.artifacts).map((artifact) => ({
              service: artifact.service?.name ?? artifact.name ?? 'service',
              imageUrl: getReleaseArtifactUri(artifact),
            }))
          : [],
        commitSha: sourceRelease.sourceCommitSha,
        promotionFlowId: promotion.flow?.id ?? null,
        targetEnvironmentId: promotedReleaseEnvironmentId,
        targetEnvironmentName: promotion.targetEnvironment.name,
        tagName,
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
