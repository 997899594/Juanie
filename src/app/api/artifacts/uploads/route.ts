import { NextResponse } from 'next/server';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createManagedArtifactUpload } from '@/lib/artifacts/upload-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repository, releaseId, name, variant, platform, format, contentType } = body;

    if (!repository || !releaseId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: repository, releaseId, name' },
        { status: 400 }
      );
    }

    const upload = await createManagedArtifactUpload({
      repository,
      releaseId,
      name,
      variant,
      platform,
      format,
      contentType,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json({ success: true, upload });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : String(error);
    const status =
      message.includes('Token does not have access') || message.includes('Missing bearer token')
        ? 401
        : 400;

    return NextResponse.json(
      {
        error: 'Failed to create artifact upload',
        details: message,
      },
      { status }
    );
  }
}
