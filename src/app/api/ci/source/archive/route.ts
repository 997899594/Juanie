import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isCiWorkloadProvider } from '@/lib/ci/workload-identity';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { isCiAccessError, verifyRepositoryAccess } from '@/lib/releases/api-access';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const repository = params.get('repository')?.trim();
    const provider = params.get('provider')?.trim();
    const ref = params.get('ref')?.trim();
    const sha = params.get('sha')?.trim();
    const baseSha = params.get('baseSha')?.trim() || null;
    const externalRunId = params.get('externalRunId')?.trim();
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
    const archiveRevision = baseSha ?? sha;
    const archive = await gateway.openRepositoryArchive(session, repository, archiveRevision);
    if (!archive.body) throw new Error('Source provider returned an empty archive body');
    return new Response(archive.body, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `attachment; filename="source-${archiveRevision.slice(0, 12)}.tar.gz"`,
        'Content-Type': 'application/gzip',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = isCiAccessError(error) ? 401 : 502;
    return NextResponse.json({ error: 'Failed to load immutable source snapshot' }, { status });
  }
}
