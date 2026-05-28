import { and, desc, eq } from 'drizzle-orm';
import { accessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { projects, releases, repositories } from '@/lib/db/schema';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';
import { buildReleaseDetailPath } from '@/lib/releases/paths';

export async function resolveRepositoryReleaseForService(input: {
  repository: string;
  ref: string;
  sha: string;
  service: string;
  authHeader: string | null;
}) {
  await verifyRepositoryAccess(input.repository, input.authHeader);

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.fullName, input.repository),
  });

  if (!repo) {
    throw accessError('not_found', 'Repository not found');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.repositoryId, repo.id),
    with: {
      services: true,
    },
  });

  if (!project) {
    throw accessError('not_found', 'Project not found');
  }

  const service = project.services.find(
    (candidate) => candidate.id === input.service || candidate.name === input.service
  );

  if (!service) {
    throw accessError('not_found', 'Service not found');
  }

  const candidates = await db.query.releases.findMany({
    where: and(
      eq(releases.projectId, project.id),
      eq(releases.sourceRepository, input.repository),
      eq(releases.sourceRef, input.ref),
      eq(releases.sourceCommitSha, input.sha)
    ),
    orderBy: [desc(releases.createdAt)],
    limit: 20,
    with: {
      artifacts: {
        with: {
          service: true,
        },
      },
    },
  });

  const release = candidates.find((candidate) =>
    candidate.artifacts.some(
      (artifact) => artifact.kind === 'image' && artifact.serviceId === service.id
    )
  );

  if (!release) {
    throw accessError('not_found', 'Release not found');
  }

  return {
    id: release.id,
    projectId: release.projectId,
    environmentId: release.environmentId,
    status: release.status,
    releasePath: buildReleaseDetailPath(release.projectId, release.environmentId, release.id),
  };
}
