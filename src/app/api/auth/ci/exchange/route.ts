import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  assertWorkloadIdentityMatchesRequest,
  verifyCiWorkloadIdentity,
} from '@/lib/ci/workload-identity';
import { db } from '@/lib/db';
import { integrationIdentities, repositories } from '@/lib/db/schema';
import { normalizeGitLabServerUrl } from '@/lib/git/gitlab-server';
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
    const { idToken, repository, ref, sha, externalRunId } = body;
    if (
      typeof idToken !== 'string' ||
      typeof repository !== 'string' ||
      typeof ref !== 'string' ||
      typeof sha !== 'string' ||
      typeof externalRunId !== 'string'
    ) {
      return NextResponse.json(
        { error: 'idToken, repository, ref, sha, and externalRunId are required' },
        { status: 400 }
      );
    }

    const repo = await db.query.repositories.findFirst({
      where: eq(repositories.fullName, repository),
    });
    if (!repo) return NextResponse.json({ error: 'Unknown repository' }, { status: 401 });
    const providerIdentity = await db.query.integrationIdentities.findFirst({
      where: eq(integrationIdentities.id, repo.providerId),
    });
    if (!providerIdentity) {
      return NextResponse.json({ error: 'Unknown repository identity' }, { status: 401 });
    }

    const gitLabIssuer =
      providerIdentity.provider === 'gitlab'
        ? 'https://gitlab.com'
        : providerIdentity.serverUrl
          ? normalizeGitLabServerUrl(providerIdentity.serverUrl)
          : null;
    const workloadIdentity = await verifyCiWorkloadIdentity({
      authHeader: `Bearer ${idToken}`,
      provider: providerIdentity.provider,
      gitLabIssuer,
    });
    assertWorkloadIdentityMatchesRequest(workloadIdentity, {
      repository,
      sourceRef: ref,
      sourceCommitSha: sha,
      externalRunId,
    });
    const exchange = await issueJuanieCiToken(workloadIdentity, {
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
