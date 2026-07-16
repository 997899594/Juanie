import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  assertWorkloadIdentityMatchesRequest,
  isCiWorkloadProvider,
  verifyCiWorkloadIdentity,
} from '@/lib/ci/workload-identity';
import { db } from '@/lib/db';
import { integrationIdentities, projects, repositories } from '@/lib/db/schema';
import { issueJuanieCiToken } from '@/lib/releases/ci-identity';

const maxExchangeBodyBytes = 32 * 1024;

async function readExchangeBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > maxExchangeBodyBytes) {
    throw new RangeError('Request body too large');
  }
  if (!request.body) throw new SyntaxError('Request body is required');

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxExchangeBodyBytes) {
        await reader.cancel();
        throw new RangeError('Request body too large');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }

  const parsed = JSON.parse(chunks.join(''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SyntaxError('Request body must be an object');
  }
  return parsed as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await readExchangeBody(request);
    const { idToken, provider, repository, ref, sha, externalRunId } = body;
    if (
      typeof idToken !== 'string' ||
      !isCiWorkloadProvider(provider) ||
      typeof repository !== 'string' ||
      typeof ref !== 'string' ||
      typeof sha !== 'string' ||
      typeof externalRunId !== 'string'
    ) {
      return NextResponse.json(
        { error: 'idToken, provider, repository, ref, sha, and externalRunId are required' },
        { status: 400 }
      );
    }

    const candidates = await db
      .select({ repository: repositories, project: projects, provider: integrationIdentities })
      .from(projects)
      .innerJoin(repositories, eq(projects.repositoryId, repositories.id))
      .innerJoin(integrationIdentities, eq(repositories.providerId, integrationIdentities.id))
      .where(
        and(eq(repositories.fullName, repository), eq(integrationIdentities.provider, provider))
      );
    if (candidates.length !== 1) {
      return NextResponse.json(
        { error: 'Unknown or ambiguous repository identity' },
        { status: 401 }
      );
    }
    const [{ repository: repo, project }] = candidates;

    const workloadIdentity = await verifyCiWorkloadIdentity({
      authHeader: `Bearer ${idToken}`,
    });
    assertWorkloadIdentityMatchesRequest(workloadIdentity, {
      repository,
      sourceRef: ref,
      sourceCommitSha: sha,
      externalRunId,
    });
    const exchange = await issueJuanieCiToken(workloadIdentity, {
      projectId: project.id,
      repositoryId: repo.id,
      provider,
      repository,
      ref,
      sha,
      externalRunId,
    });
    return NextResponse.json({ ...exchange, tokenType: 'Bearer' });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Invalid CI workload identity' }, { status: 401 });
  }
}
