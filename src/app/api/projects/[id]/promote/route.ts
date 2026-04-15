import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectWithRepositoryAccessOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments, projects, promotionFlows, releases, repositories } from '@/lib/db/schema';
import { resolvePrimaryPromotionFlow } from '@/lib/environments/promotion';
import { normalizeGitLabServerUrl } from '@/lib/git/gitlab-server';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { createProjectRelease } from '@/lib/releases';
import { buildPromotionPlan } from '@/lib/releases/planning';
import { ReleaseSchemaGateBlockedError } from '@/lib/releases/schema-gate';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);

    const envList = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    });
    const flowList = await db.query.promotionFlows.findMany({
      where: eq(promotionFlows.projectId, id),
    });
    const { targetEnvironment: prodEnv } = resolvePrimaryPromotionFlow({
      environments: envList,
      promotionFlows: flowList,
    });

    if (prodEnv && !canManageEnvironment(member.role, prodEnv)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(prodEnv) }, { status: 403 });
    }

    const promotion = await buildPromotionPlan(id);

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

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project, member } = await getProjectWithRepositoryAccessOrThrow(id, session.user.id);

    const envList = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    });
    const flowList = await db.query.promotionFlows.findMany({
      where: eq(promotionFlows.projectId, id),
    });
    const {
      flow: promotionFlow,
      sourceEnvironment: stagingEnv,
      targetEnvironment: prodEnv,
    } = resolvePrimaryPromotionFlow({
      environments: envList,
      promotionFlows: flowList,
    });

    if (!stagingEnv) {
      return NextResponse.json({ error: 'No promotion source environment found' }, { status: 400 });
    }
    if (!prodEnv) {
      return NextResponse.json({ error: 'No production environment found' }, { status: 400 });
    }
    if (!canManageEnvironment(member.role, prodEnv)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(prodEnv) }, { status: 403 });
    }
    if (!prodEnv.namespace) {
      return NextResponse.json(
        { error: 'Production environment namespace not provisioned yet' },
        { status: 400 }
      );
    }

    const promotion = await buildPromotionPlan(id);
    const sourceRelease = promotion.sourceRelease
      ? await db.query.releases.findFirst({
          where: eq(releases.id, promotion.sourceRelease.id),
          with: {
            artifacts: {
              with: {
                service: true,
              },
            },
          },
        })
      : null;

    if (!promotion.plan.canCreate) {
      return NextResponse.json(
        { error: promotion.plan.blockingReason ?? 'Unable to promote' },
        { status: 400 }
      );
    }

    if (!sourceRelease || sourceRelease.artifacts.length === 0) {
      return NextResponse.json(
        { error: 'Staging release has no artifacts — trigger a fresh release first' },
        { status: 400 }
      );
    }

    const prodRelease = await createProjectRelease({
      projectId: id,
      environmentId: prodEnv.id,
      services: sourceRelease.artifacts.map((artifact) => ({
        id: artifact.serviceId,
        name: artifact.service.name,
        image: artifact.imageUrl,
        digest: artifact.imageDigest,
      })),
      sourceRepository: project.repository?.fullName ?? project.name,
      sourceRef: sourceRelease.sourceRef ?? `refs/heads/${project.productionBranch ?? 'main'}`,
      sourceCommitSha: sourceRelease.sourceCommitSha,
      configCommitSha: sourceRelease.configCommitSha,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      summary: `Promote ${sourceRelease.sourceCommitSha?.slice(0, 7) ?? 'release'} to ${prodEnv.name}`,
    });

    // Create git tag (best-effort, don't fail if this errors)
    const tagName = await createGitTag(
      project,
      sourceRelease.sourceCommitSha,
      session.user.id
    ).catch((e) => {
      console.warn('Failed to create git tag:', e);
      return null;
    });

    return NextResponse.json(
      {
        success: true,
        releaseId: prodRelease?.id,
        plan: promotion.plan,
        artifacts: prodRelease?.artifacts.map((artifact) => ({
          service: artifact.service.name,
          imageUrl: artifact.imageUrl,
        })),
        commitSha: sourceRelease.sourceCommitSha,
        promotionFlowId: promotionFlow?.id ?? null,
        tagName,
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

async function createGitTag(
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
  commitSha: string | null,
  actingUserId?: string | null
): Promise<string | null> {
  if (!commitSha || !project.repository) return null;

  const tag = `v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}-${commitSha.slice(0, 7)}`;

  const integrationSession = await getTeamIntegrationSession({
    teamId: project.teamId,
    actingUserId,
    requiredCapabilities: [],
  });

  const { provider, accessToken } = integrationSession;
  const repoFullName = project.repository.fullName;

  if (provider === 'github') {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/git/refs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: commitSha }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub tag creation failed: ${JSON.stringify(err)}`);
    }
    return tag;
  }

  if (provider === 'gitlab' || provider === 'gitlab-self-hosted') {
    const baseUrl = normalizeGitLabServerUrl(integrationSession.serverUrl);
    const encodedRepo = encodeURIComponent(repoFullName);
    const res = await fetch(`${baseUrl}/api/v4/projects/${encodedRepo}/repository/tags`, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tag_name: tag, ref: commitSha }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitLab tag creation failed: ${JSON.stringify(err)}`);
    }
    return tag;
  }

  return null;
}
