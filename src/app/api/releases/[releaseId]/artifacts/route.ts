import { NextResponse } from 'next/server';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { appendReleaseDeliveryArtifacts } from '@/lib/artifacts/upload-service';
import { isCiAccessError } from '@/lib/releases/api-access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  try {
    const { releaseId } = await params;
    const body = await request.json();
    const { repository, artifacts } = body;

    if (!repository || !Array.isArray(artifacts) || artifacts.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: repository, artifacts[]' },
        { status: 400 }
      );
    }

    const inserted = await appendReleaseDeliveryArtifacts({
      releaseId,
      repository,
      artifacts,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json({ success: true, artifacts: inserted }, { status: 201 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : String(error);
    const status = isCiAccessError(error) ? 401 : 400;

    return NextResponse.json(
      {
        error: 'Failed to append release artifacts',
        details: message,
      },
      { status }
    );
  }
}
