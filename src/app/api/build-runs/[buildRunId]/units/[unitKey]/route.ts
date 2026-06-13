import { NextResponse } from 'next/server';
import { BuildRunError, completeBuildUnit } from '@/lib/builds/service';
import type { BuildUnitStatus } from '@/lib/db/schema';

const validStatuses = new Set<BuildUnitStatus>(['running', 'succeeded', 'failed']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ buildRunId: string; unitKey: string }> }
) {
  try {
    const { buildRunId, unitKey } = await params;
    const body = await request.json();
    const status = body.status as BuildUnitStatus;

    if (!validStatuses.has(status)) {
      return NextResponse.json({ error: 'Invalid build unit status' }, { status: 400 });
    }

    const buildRun = await completeBuildUnit({
      buildRunId,
      unitKey,
      status,
      image: typeof body.image === 'string' ? body.image : null,
      imageDigest: typeof body.imageDigest === 'string' ? body.imageDigest : null,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : null,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : undefined,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json({ success: true, buildRun });
  } catch (error) {
    const status =
      error instanceof BuildRunError
        ? error.statusCode
        : error instanceof Error &&
            (error.message.includes('Token does not have access') ||
              error.message.includes('Missing bearer token'))
          ? 401
          : 400;

    return NextResponse.json(
      {
        error: 'Failed to update build unit',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
