import { NextResponse } from 'next/server';
import { createRepositoryRelease } from '@/lib/releases';

async function verifyRepositoryAccess(repository: string, authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.substring(7);
  const repoRes = await fetch(`https://api.github.com/repos/${repository}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!repoRes.ok) {
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
