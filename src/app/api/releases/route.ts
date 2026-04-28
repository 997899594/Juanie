import { NextResponse } from 'next/server';
import { PreviewCloneUnsupportedError } from '@/lib/databases/platform-support';
import { createRepositoryRelease } from '@/lib/releases';
import { ReleaseAdmissionError } from '@/lib/releases/admission';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { PreviewDatabaseGuardBlockedError } from '@/lib/releases/preview-database-guard';
import { ReleaseSchemaGateBlockedError } from '@/lib/schema-safety';

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
          releasePath: release
            ? buildReleaseDetailPath(release.projectId, release.environmentId, release.id)
            : null,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      error instanceof ReleaseSchemaGateBlockedError ||
      error instanceof PreviewDatabaseGuardBlockedError ||
      error instanceof PreviewCloneUnsupportedError ||
      error instanceof ReleaseAdmissionError
        ? 409
        : message.includes('Token does not have access') || message.includes('Missing bearer token')
          ? 401
          : 400;
    return NextResponse.json(
      {
        error: 'Failed to create release',
        details: message,
      },
      { status }
    );
  }
}
