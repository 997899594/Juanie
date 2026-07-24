import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCiWorkloadProvider } from '@/lib/ci/workload-identity';
import { failCiOwnedDeliveryPhase } from '@/lib/delivery-executions/service';
import { isCiAccessError, verifyRepositoryAccess } from '@/lib/releases/api-access';

const requestSchema = z
  .object({
    repository: z.string().min(3).max(255),
    provider: z.string().refine(isCiWorkloadProvider),
    ref: z.string().min(1).max(255),
    sha: z.string().regex(/^[a-f0-9]{40}$/u),
    externalRunId: z.string().min(1).max(255),
    planResult: z.enum(['success', 'failure', 'cancelled']),
    buildResult: z.enum(['failure', 'cancelled', 'skipped']),
  })
  .refine(
    ({ planResult, buildResult }) =>
      planResult === 'failure' ||
      planResult === 'cancelled' ||
      buildResult === 'failure' ||
      buildResult === 'cancelled',
    { message: 'At least one CI-owned phase must have failed or been cancelled' }
  );

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid CI failure outcome' }, { status: 400 });
    }
    const input = parsed.data;
    const access = await verifyRepositoryAccess(
      input.repository,
      request.headers.get('authorization'),
      {
        provider: input.provider,
        ref: input.ref,
        sha: input.sha,
        externalRunId: input.externalRunId,
      }
    );
    const result = await failCiOwnedDeliveryPhase({
      repositoryId: access.repositoryId,
      provider: access.provider,
      providerDeliveryId: input.externalRunId,
      sourceRepository: input.repository,
      sourceRef: input.ref,
      sourceCommitSha: input.sha,
      planResult: input.planResult,
      buildResult: input.buildResult,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const status = isCiAccessError(error) ? 401 : 409;
    return NextResponse.json(
      {
        error: 'Failed to settle CI-owned delivery phase',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
