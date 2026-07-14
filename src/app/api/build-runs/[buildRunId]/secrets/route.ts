import { NextResponse } from 'next/server';
import { BuildRunError, getBuildRunSecrets } from '@/lib/builds/service';
import { requireBearerToken } from '@/lib/releases/api-access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ buildRunId: string }> }
) {
  try {
    const { buildRunId } = await params;
    const unitKey = new URL(request.url).searchParams.get('unitKey');
    if (!unitKey) {
      return NextResponse.json({ error: 'Missing unitKey' }, { status: 400 });
    }
    const secrets = await getBuildRunSecrets({
      buildRunId,
      unitKey,
      capabilityToken: requireBearerToken(request.headers.get('authorization')),
    });
    return NextResponse.json(
      { secrets },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  } catch (error) {
    const status = error instanceof BuildRunError ? error.statusCode : 400;
    return NextResponse.json(
      {
        error: 'Failed to resolve build secrets',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
