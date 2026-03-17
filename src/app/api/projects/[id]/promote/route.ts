import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, environments, projects, repositories, teamMembers } from '@/lib/db/schema';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { addDeploymentJob } from '@/lib/queue';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!prodEnv.namespace) {
    return NextResponse.json(
      { error: 'Production environment namespace not provisioned yet' },
      { status: 400 }
    );
  }

  // Find the latest successful staging deployment that has an imageUrl
  const sourceDeployment = await db.query.deployments.findFirst({
    where: and(
      eq(deployments.projectId, id),
      eq(deployments.environmentId, stagingEnv.id),
      eq(deployments.status, 'running')
    ),
    orderBy: [desc(deployments.createdAt)],
  });

  if (!sourceDeployment) {
    return NextResponse.json(
      { error: 'No successful staging deployment found to promote' },
      { status: 400 }
    );
  }

  if (!sourceDeployment.imageUrl) {
    return NextResponse.json(
      { error: 'Staging deployment has no image URL — trigger a fresh deployment first' },
      { status: 400 }
    );
  }

  // Create production deployment record, reusing the same image (no rebuild)
  const [prodDeployment] = await db
    .insert(deployments)
    .values({
      projectId: id,
      environmentId: prodEnv.id,
      status: 'queued',
      imageUrl: sourceDeployment.imageUrl,
      commitSha: sourceDeployment.commitSha,
      commitMessage: sourceDeployment.commitMessage,
      branch: sourceDeployment.branch,
      version: sourceDeployment.version,
      deployedById: session.user.id,
    })
    .returning();

  // Queue the deployment (worker will skip build since imageUrl is already set)
  await addDeploymentJob(prodDeployment.id, id, prodEnv.id);

  // Create git tag (best-effort, don't fail if this errors)
  const tagName = await createGitTag(project, sourceDeployment.commitSha).catch((e) => {
    console.warn('Failed to create git tag:', e);
    return null;
  });

  return NextResponse.json({
    success: true,
    deploymentId: prodDeployment.id,
    imageUrl: sourceDeployment.imageUrl,
    commitSha: sourceDeployment.commitSha,
    tagName,
  });
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
