import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { integrationIdentities, repositories } from '@/lib/db/schema';
import { createRepositoryRelease } from '@/lib/releases';

async function verifyRepositoryAccess(repository: string, authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.substring(7);
  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.fullName, repository),
  });

  if (!repo) {
    throw new Error(`Repository ${repository} not found in Juanie`);
  }

  const identity = await db.query.integrationIdentities.findFirst({
    where: eq(integrationIdentities.id, repo.providerId),
  });

  if (!identity) {
    throw new Error('Repository integration identity not found');
  }

  if (identity.provider === 'github') {
    const repoRes = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (repoRes.ok) {
      return;
    }
  } else {
    const baseUrl =
      identity.provider === 'gitlab'
        ? 'https://gitlab.com'
        : repo.webUrl
          ? new URL(repo.webUrl).origin
          : repo.cloneUrl
            ? new URL(repo.cloneUrl).origin
            : null;

    if (!baseUrl) {
      throw new Error('Unable to resolve Git provider URL for repository');
    }

    const encodedPath = encodeURIComponent(repository);
    const repoRes = await fetch(`${baseUrl}/api/v4/projects/${encodedPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'PRIVATE-TOKEN': token,
        'JOB-TOKEN': token,
      },
    });

    if (repoRes.ok) {
      return;
    }
  }

  if (identity.provider === 'gitlab' || identity.provider === 'gitlab-self-hosted') {
    throw new Error('Token does not have access to this GitLab repository');
  }

  if (identity.provider === 'github') {
    throw new Error('Token does not have access to this repository');
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();
    const { repository, sha, ref, services, serviceId, serviceName, image, summary } = body;

    if (!repository || !ref || (!image && (!Array.isArray(services) || services.length === 0))) {
      return NextResponse.json(
        {
          error: 'Missing required fields: repository, ref, and either image or services[]',
        },
        { status: 400 }
      );
    }

    await verifyRepositoryAccess(repository, authHeader);

    const release = await createRepositoryRelease({
      repository,
      ref,
      sha,
      services,
      serviceId,
      serviceName,
      image,
      triggeredBy: 'api',
      summary: summary ?? (sha ? `Release ${sha.substring(0, 7)}` : 'Queued release'),
    });

    return NextResponse.json(
      {
        success: true,
        release,
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('Token does not have access') ? 401 : 400;
    return NextResponse.json(
      {
        error: 'Failed to create release',
        details: message,
      },
      { status }
    );
  }
}
