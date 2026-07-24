import { NextResponse } from 'next/server';
import { BuildRunError, completeBuildRunDelivery } from '@/lib/builds/service';
import { isCiAccessError } from '@/lib/releases/api-access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ buildRunId: string }> }
) {
  try {
    const { buildRunId } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.status !== 'succeeded' && body.status !== 'failed') {
      return NextResponse.json({ error: 'status must be succeeded or failed' }, { status: 400 });
    }
    const result = await completeBuildRunDelivery({
      buildRunId,
      status: body.status,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : null,
      authHeader: request.headers.get('authorization'),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const status =
      error instanceof BuildRunError ? error.statusCode : isCiAccessError(error) ? 401 : 400;
    return NextResponse.json(
      {
        error: 'Failed to complete build run delivery',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
