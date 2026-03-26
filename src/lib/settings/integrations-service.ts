import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  integrationCapabilitySnapshots,
  integrationGrants,
  integrationIdentities,
  repositories,
  teamMembers,
} from '@/lib/db/schema';
import { buildIntegrationsControlPlaneView } from '@/lib/settings/integrations-view';

export async function getIntegrationsControlPlanePageData(userId: string) {
  const [identities, memberships] = await Promise.all([
    db.query.integrationIdentities.findMany({
      where: eq(integrationIdentities.userId, userId),
      orderBy: [desc(integrationIdentities.createdAt)],
    }),
    db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, userId),
      with: {
        team: true,
      },
      orderBy: [desc(teamMembers.createdAt)],
    }),
  ]);

  const identityIds = identities.map((identity) => identity.id);
  const grants =
    identityIds.length > 0
      ? await db.query.integrationGrants.findMany({
          where: inArray(integrationGrants.integrationIdentityId, identityIds),
          orderBy: [desc(integrationGrants.createdAt)],
        })
      : [];

  const activeGrantByIdentityId = new Map<string, (typeof grants)[number]>();
  for (const grant of grants) {
    if (grant.revokedAt) continue;
    if (activeGrantByIdentityId.has(grant.integrationIdentityId)) continue;
    activeGrantByIdentityId.set(grant.integrationIdentityId, grant);
  }

  const activeGrantIds = Array.from(activeGrantByIdentityId.values()).map((grant) => grant.id);
  const capabilityRows =
    activeGrantIds.length > 0
      ? await db.query.integrationCapabilitySnapshots.findMany({
          where: inArray(integrationCapabilitySnapshots.integrationGrantId, activeGrantIds),
        })
      : [];

  const repositoriesByIdentityId =
    identityIds.length > 0
      ? await db.query.repositories.findMany({
          where: inArray(repositories.providerId, identityIds),
          orderBy: [desc(repositories.createdAt)],
          with: {
            projects: {
              with: {
                team: true,
              },
            },
          },
        })
      : [];

  const capabilitiesByGrantId = new Map<string, (typeof capabilityRows)[number]['capability'][]>();
  for (const row of capabilityRows) {
    const bucket = capabilitiesByGrantId.get(row.integrationGrantId) ?? [];
    bucket.push(row.capability);
    capabilitiesByGrantId.set(row.integrationGrantId, bucket);
  }

  const repositoriesGrouped = new Map<string, typeof repositoriesByIdentityId>();
  for (const repository of repositoriesByIdentityId) {
    const bucket = repositoriesGrouped.get(repository.providerId) ?? [];
    bucket.push(repository);
    repositoriesGrouped.set(repository.providerId, bucket);
  }

  const integrations = identities.map((identity) => {
    const grant = activeGrantByIdentityId.get(identity.id) ?? null;
    return {
      id: identity.id,
      provider: identity.provider,
      username: identity.username,
      createdAt: identity.createdAt,
      grant: grant
        ? {
            id: grant.id,
            expiresAt: grant.expiresAt,
            revokedAt: grant.revokedAt,
            capabilities: capabilitiesByGrantId.get(grant.id) ?? [],
          }
        : null,
      repositories: repositoriesGrouped.get(identity.id) ?? [],
    };
  });

  return {
    overview: buildIntegrationsControlPlaneView({
      integrations,
      teamScopes: memberships.map((membership) => ({
        id: membership.teamId,
        name: membership.team.name,
        slug: membership.team.slug,
        role: membership.role,
      })),
    }),
  };
}
