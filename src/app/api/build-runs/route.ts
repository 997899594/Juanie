import { NextResponse } from 'next/server';
import { BuildRunError, startBuildRun } from '@/lib/builds/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repository, ref, sha, registry, provider, externalRunId, services, targets } = body;

    if (
      typeof repository !== 'string' ||
      typeof ref !== 'string' ||
      typeof sha !== 'string' ||
      !repository ||
      !ref ||
      !sha
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: repository, ref, sha' },
        { status: 400 }
      );
    }

    const result = await startBuildRun({
      repository,
      ref,
      sha,
      registry: typeof registry === 'string' && registry.trim() ? registry.trim() : undefined,
      services: Array.isArray(services)
        ? services.filter((item) => typeof item === 'string')
        : undefined,
      targets: Array.isArray(targets)
        ? targets.filter((item) => typeof item === 'string')
        : undefined,
      provider: typeof provider === 'string' && provider.trim() ? provider.trim() : undefined,
      externalRunId:
        typeof externalRunId === 'string' && externalRunId.trim()
          ? externalRunId.trim()
          : undefined,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json(
      {
        success: true,
        buildRun: result.buildRun,
        plan: result.plan,
        secretAccessToken: result.secretAccessToken,
      },
      { status: 201 }
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
        error: 'Failed to start build run',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
