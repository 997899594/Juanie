import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, releases, repositories, teamMembers } from '@/lib/db/schema';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { createProjectRelease } from '@/lib/releases';
import { buildPromotionPlan } from '@/lib/releases/planning';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, id),
  });
  const prodEnv = envList.find((environment) => environment.isProduction);

  if (prodEnv && !canManageEnvironment(member.role, prodEnv)) {
    return NextResponse.json({ error: getEnvironmentGuardReason(prodEnv) }, { status: 403 });
  }

  const promotion = await buildPromotionPlan(id);

  return NextResponse.json(promotion);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { repository: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Auth: team member required
  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Find staging (autoDeploy=true) and production (isProduction=true) environments
  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, id),
  });

  const stagingEnv = envList.find((e) => e.autoDeploy && !e.isProduction);
  const prodEnv = envList.find((e) => e.isProduction);

  if (!stagingEnv) {
    return NextResponse.json({ error: 'No staging environment found' }, { status: 400 });
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
    sourceRef: `refs/heads/${prodEnv.branch ?? project.productionBranch ?? 'main'}`,
    sourceCommitSha: sourceRelease.sourceCommitSha,
    configCommitSha: sourceRelease.configCommitSha,
    triggeredBy: 'manual',
    triggeredByUserId: session.user.id,
    summary: `Promote ${sourceRelease.sourceCommitSha?.slice(0, 7) ?? 'release'} to production`,
  });

  // Create git tag (best-effort, don't fail if this errors)
  const tagName = await createGitTag(project, sourceRelease.sourceCommitSha).catch((e) => {
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
      tagName,
    },
    { status: 202 }
  );
}

async function createGitTag(
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
  commitSha: string | null
): Promise<string | null> {
  if (!commitSha || !project.repository) return null;

  const tag = `v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}-${commitSha.slice(0, 7)}`;

  const integrationSession = await getTeamIntegrationSession({
    teamId: project.teamId,
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
    const baseUrl =
      provider === 'gitlab-self-hosted'
        ? (process.env.GITLAB_URL ?? 'https://gitlab.com')
        : 'https://gitlab.com';
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
