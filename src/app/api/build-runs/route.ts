import { NextResponse } from 'next/server';
import { startBuildRunSchema } from '@/lib/builds/api-schema';
import { BuildRunError, startBuildRun } from '@/lib/builds/service';
import { isCiAccessError } from '@/lib/releases/api-access';

export async function POST(request: Request) {
  try {
    const parsed = startBuildRunSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid build run request',
          details: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const result = await startBuildRun({
      repository: input.repository,
      ref: input.ref,
      sha: input.sha,
      beforeSha: input.beforeSha,
      forceFullBuild: input.forceFullBuild,
      monorepoAnalysis: input.monorepoAnalysis,
      provider: input.provider,
      externalRunId: input.externalRunId,
      authHeader: request.headers.get('authorization'),
    });

    return NextResponse.json(
      {
        success: true,
        buildRun: result.buildRun,
        plan: result.plan,
      },
      { status: 201 }
    );
  } catch (error) {
    const status =
      error instanceof BuildRunError ? error.statusCode : isCiAccessError(error) ? 401 : 400;

    return NextResponse.json(
      {
        error: 'Failed to start build run',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
