import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BuildRunError, startBuildRun } from '@/lib/builds/service';
import { isCiAccessError } from '@/lib/releases/api-access';

const startBuildRunSchema = z
  .object({
    repository: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[^/\s]+\/[^/\s]+$/u),
    ref: z.string().min(1).max(255),
    sha: z.string().regex(/^[a-f0-9]{40}$/u),
    beforeSha: z
      .string()
      .regex(/^[a-f0-9]{40}$/u)
      .optional()
      .nullable(),
    provider: z.enum(['github', 'gitlab', 'gitlab-self-hosted']),
    externalRunId: z.string().min(1).max(255).optional().nullable(),
    forceFullBuild: z.boolean().optional().default(false),
  })
  .strict();

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
