import { NextResponse } from 'next/server';
import { BuildRunError, finalizeBuildRun } from '@/lib/builds/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ buildRunId: string }> }
) {
  try {
    const { buildRunId } = await params;
    const result = await finalizeBuildRun({
      buildRunId,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json(
      {
        success: true,
        buildRun: result.buildRun,
        release: result.release,
      },
      { status: 202 }
    );
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
        error: 'Failed to finalize build run',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
