import { NextResponse } from 'next/server';
import { getReleaseAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { getReleaseById } from '@/lib/releases';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  try {
    const { releaseId } = await params;
    const session = await requireSession();
    await getReleaseAccessOrThrow(releaseId, session.user.id);

    const fullRelease = await getReleaseById(releaseId);
    return NextResponse.json(fullRelease);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
