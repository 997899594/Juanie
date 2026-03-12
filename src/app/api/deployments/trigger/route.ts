import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { environments } from '@/lib/db/schema';
import { deployments, projects, repositories } from '@/lib/db/schema';
import { addDeploymentJob } from '@/lib/queue';

type Environment = typeof environments.$inferSelect;

/**
 * glob 匹配：仅支持 * 通配符（足够处理 v* / release-* 等常见 tag 模式）
 */
function matchesGlob(pattern: string, value: string): boolean {
  const regex = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
  );
  return regex.test(value);
}

/**
 * 根据 ref 解析目标 environment：
 * - refs/tags/v1.0  → 按 tagPattern glob 匹配，无匹配则回退到 production branch
 * - refs/heads/main → 按 branch 精确匹配
 */
function resolveEnvironment(ref: string, envs: Environment[]): Environment | undefined {
  if (ref.startsWith('refs/tags/')) {
    const tag = ref.slice('refs/tags/'.length);
    // 1. 精确的 tagPattern 匹配
    const byTag = envs.find((e) => e.tagPattern && matchesGlob(e.tagPattern, tag));
    if (byTag) return byTag;
    // 2. 回退：找 production branch（main / master）
    return envs.find((e) => e.branch === 'main' || e.branch === 'master');
  }

  const branch = ref.replace('refs/heads/', '');
  return envs.find((e) => e.branch === branch);
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();
    const { repository, sha, ref, image } = body;

    if (!repository || !sha || !image) {
      return NextResponse.json(
        { error: 'Missing required fields: repository, sha, image' },
        { status: 400 }
      );
    }

    // Verify GitHub token only when it looks like a GitHub token (ghp_, ghs_, github_pat_).
    // GitLab CI_JOB_TOKEN and other providers are accepted without extra verification;
    // the repository lookup below is the primary security gate.
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const isGitHubToken =
        token.startsWith('ghp_') ||
        token.startsWith('ghs_') ||
        token.startsWith('github_pat_') ||
        token.startsWith('v1.');

      if (isGitHubToken) {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        });

        if (!userRes.ok) {
          return NextResponse.json({ error: 'Invalid GitHub token' }, { status: 401 });
        }
      }
    }

    // Find project by repository
    const repo = await db.query.repositories.findFirst({
      where: eq(repositories.fullName, repository),
    });

    if (!repo) {
      return NextResponse.json(
        { error: `Repository ${repository} not found in Juanie` },
        { status: 404 }
      );
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.repositoryId, repo.id),
      with: {
        environments: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: `No project linked to repository ${repository}` },
        { status: 404 }
      );
    }

    // Determine environment based on ref
    // Tags (refs/tags/v1.0): match by tagPattern glob, fall back to production branch
    // Branches (refs/heads/main): match by branch name
    const environment = resolveEnvironment(ref, project.environments);

    if (!environment) {
      return NextResponse.json(
        { error: `No environment configured for ref ${ref}` },
        { status: 404 }
      );
    }

    // Create deployment
    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        environmentId: environment.id,
        commitSha: sha,
        commitMessage: `Deploy ${sha.substring(0, 7)}`,
        imageUrl: image,
        status: 'queued',
      })
      .returning();

    // Queue deployment job
    await addDeploymentJob(deployment.id, project.id, environment.id);

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        project: project.name,
        environment: environment.name,
        sha: sha.substring(0, 7),
      },
    });
  } catch (error) {
    console.error('Failed to trigger deployment:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger deployment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
