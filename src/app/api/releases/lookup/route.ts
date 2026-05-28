import { NextResponse } from 'next/server';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { resolveRepositoryReleaseForService } from '@/lib/releases/lookup-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repository, ref, sha, service } = body;

    if (!repository || !ref || !sha || !service) {
      return NextResponse.json(
        { error: 'Missing required fields: repository, ref, sha, service' },
        { status: 400 }
      );
    }

    const release = await resolveRepositoryReleaseForService({
      repository,
      ref,
      sha,
      service,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json({ success: true, release });
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
        error: 'Failed to resolve release',
        details: message,
      },
      { status }
    );
  }
}
