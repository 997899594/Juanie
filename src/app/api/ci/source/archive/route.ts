import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isCiWorkloadProvider } from '@/lib/ci/workload-identity';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';
import { RepositoryArchiveError } from '@/lib/git/repository-archive';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { logger } from '@/lib/logger';
import { isCiAccessError, verifyRepositoryAccess } from '@/lib/releases/api-access';

const archiveLogger = logger.child({ component: 'ci-source-archive' });

function observeArchiveBody(
  body: ReadableStream<Uint8Array>,
  context: Record<string, unknown>
): ReadableStream<Uint8Array> {
  const reader = body.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) controller.close();
        else controller.enqueue(chunk.value);
      } catch (error) {
        archiveLogger.error('Source archive stream failed', error, context);
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  let repository: string | null = null;
  let provider: string | null = null;
  let archiveRevision: string | null = null;
  let externalRunId: string | null = null;

  try {
    const params = new URL(request.url).searchParams;
    repository = params.get('repository')?.trim() ?? null;
    provider = params.get('provider')?.trim() ?? null;
    const ref = params.get('ref')?.trim();
    const sha = params.get('sha')?.trim();
    const baseSha = params.get('baseSha')?.trim() || null;
    externalRunId = params.get('externalRunId')?.trim() ?? null;
    if (
      !repository ||
      !isCiWorkloadProvider(provider) ||
      !ref ||
      !sha ||
      !/^[a-f0-9]{40}$/u.test(sha) ||
      (baseSha !== null && !/^[a-f0-9]{40}$/u.test(baseSha)) ||
      !externalRunId
    ) {
      return NextResponse.json(
        { error: 'repository, provider, ref, sha, and externalRunId are required' },
        { status: 400 }
      );
    }

    const access = await verifyRepositoryAccess(repository, request.headers.get('authorization'), {
      provider,
      ref,
      sha,
      ...(baseSha ? { beforeSha: baseSha } : {}),
      externalRunId,
    });
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, access.projectId), eq(projects.repositoryId, access.repositoryId)),
      columns: { teamId: true },
    });
    const sourceRepository = await db.query.repositories.findFirst({
      where: and(eq(repositories.id, access.repositoryId), eq(repositories.fullName, repository)),
      columns: { providerId: true },
    });
    if (!project || !sourceRepository) {
      return NextResponse.json({ error: 'Bound source repository was not found' }, { status: 404 });
    }

    const session = await getTeamIntegrationSession({
      integrationId: sourceRepository.providerId,
      teamId: project.teamId,
      requiredCapabilities: ['read_repo'],
    });
    archiveRevision = baseSha ?? sha;
    const archive = await gateway.openRepositoryArchive(session, repository, archiveRevision);
    const headers = new Headers({
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': `attachment; filename="source-${archiveRevision.slice(0, 12)}.tar.gz"`,
      'Content-Type': archive.contentType,
      'X-Content-Type-Options': 'nosniff',
    });
    if (archive.contentLength !== null) {
      headers.set('Content-Length', String(archive.contentLength));
    }

    return new Response(
      observeArchiveBody(archive.body, {
        repository,
        provider,
        archiveRevision,
        externalRunId,
      }),
      { headers }
    );
  } catch (error) {
    const status = isCiAccessError(error) ? 401 : 502;
    archiveLogger.error('Failed to load immutable source snapshot', error, {
      repository,
      provider,
      archiveRevision,
      externalRunId,
      ...(error instanceof RepositoryArchiveError
        ? {
            archiveErrorCode: error.code,
            upstreamStatus: error.upstreamStatus,
          }
        : {}),
    });

    if (error instanceof RepositoryArchiveError) {
      return NextResponse.json(
        {
          error: 'Failed to load immutable source snapshot',
          code: 'SOURCE_ARCHIVE_PROVIDER_FAILURE',
          providerError: error.code,
          upstreamStatus: error.upstreamStatus,
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to load immutable source snapshot',
        code: isCiAccessError(error) ? 'SOURCE_ARCHIVE_ACCESS_DENIED' : 'SOURCE_ARCHIVE_FAILURE',
      },
      { status }
    );
  }
}
