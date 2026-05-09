import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createReleaseArtifactDownload } from '@/lib/artifacts/download-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ releaseId: string; artifactId: string }> }
) {
  try {
    const session = await requireSession();
    const { releaseId, artifactId } = await params;
    const download = await createReleaseArtifactDownload({
      releaseId,
      artifactId,
      userId: session.user.id,
      audit: {
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    return NextResponse.json(download);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Failed to create artifact download';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
