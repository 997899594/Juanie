import { NextResponse } from 'next/server';
import { createRepositoryRelease } from '@/lib/releases';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';

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
      summary: summary ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        release: {
          ...release,
          releasePath: release ? `/projects/${release.projectId}/releases/${release.id}` : null,
        },
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
