import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deployments, projects, repositories } from '@/lib/db/schema';
import { addDeploymentJob } from '@/lib/queue';

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

    // Verify GitHub token (optional, for additional security)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Verify token with GitHub API
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
    const branch = ref.replace('refs/heads/', '');
    const environment = project.environments.find((env) => env.branch === branch);

    if (!environment) {
      return NextResponse.json(
        { error: `No environment configured for branch ${branch}` },
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
