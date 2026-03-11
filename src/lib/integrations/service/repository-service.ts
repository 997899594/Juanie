import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { repositories } from '@/lib/db/schema';
import type { GitRepository } from '@/lib/git';
import type { IntegrationSession } from './integration-control-plane';
import { gateway } from './integration-control-plane';

/**
 * Inserts a repository record into the database.
 *
 * @param repoDetails - Repository details from the Git provider
 * @param integrationId - The integration identity ID
 * @returns The database repository ID (UUID)
 */
export async function insertRepositoryRecord(
  repoDetails: GitRepository,
  integrationId: string
): Promise<string> {
  const [newRepo] = await db
    .insert(repositories)
    .values({
      providerId: integrationId,
      externalId: repoDetails.id,
      fullName: repoDetails.fullName,
      name: repoDetails.name,
      owner: repoDetails.owner,
      cloneUrl: repoDetails.cloneUrl,
      sshUrl: repoDetails.sshUrl || null,
      webUrl: repoDetails.webUrl,
      defaultBranch: repoDetails.defaultBranch,
      isPrivate: repoDetails.isPrivate,
    })
    .returning();

  return newRepo.id;
}

/**
 * Ensures a repository record exists in the database.
 * If it doesn't exist, fetches details from the Git provider and creates it.
 *
 * @param externalId - The repository's external ID from the Git provider
 * @param repositoryFullName - The full name of the repository (owner/repo)
 * @param session - The integration session for API access
 * @returns The database repository ID (UUID)
 */
export async function ensureRepository(
  externalId: string,
  repositoryFullName: string,
  session: IntegrationSession
): Promise<string> {
  // Check if repository already exists
  const existingRepo = await db.query.repositories.findFirst({
    where: eq(repositories.externalId, externalId),
  });

  if (existingRepo) {
    return existingRepo.id;
  }

  // Fetch repository details from Git provider
  const repoDetails = await gateway.getRepository(session, repositoryFullName);

  if (!repoDetails) {
    throw new Error(`Repository ${repositoryFullName} not found`);
  }

  // Create new repository record
  return insertRepositoryRecord(repoDetails, session.integrationId);
}
