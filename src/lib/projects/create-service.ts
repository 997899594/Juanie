import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  integrationCapabilitySnapshots,
  integrationGrants,
  integrationIdentities,
  teamMembers,
} from '@/lib/db/schema';
import { buildCreateProjectPageData } from '@/lib/projects/create-view';

export async function getCreateProjectPageData(userId: string) {
  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: true,
    },
    orderBy: [desc(teamMembers.createdAt)],
  });

  if (memberships.length === 0) {
    return buildCreateProjectPageData({ teamScopes: [] });
  }

  const teamIds = memberships.map((membership) => membership.teamId);
  const owners = await db.query.teamMembers.findMany({
    where: (member, { and, eq, inArray }) =>
      and(inArray(member.teamId, teamIds), eq(member.role, 'owner')),
  });

  const ownerIds = Array.from(new Set(owners.map((owner) => owner.userId)));
  const identities =
    ownerIds.length > 0
      ? await db.query.integrationIdentities.findMany({
          where: inArray(integrationIdentities.userId, ownerIds),
          orderBy: [desc(integrationIdentities.createdAt)],
        })
      : [];

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
    if (grant.expiresAt && grant.expiresAt < new Date()) continue;
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

  const capabilitiesByGrantId = new Map<string, string[]>();
  for (const row of capabilityRows) {
    const bucket = capabilitiesByGrantId.get(row.integrationGrantId) ?? [];
    bucket.push(row.capability);
    capabilitiesByGrantId.set(row.integrationGrantId, bucket);
  }

  const identitiesByUserId = new Map<string, typeof identities>();
  for (const identity of identities) {
    const bucket = identitiesByUserId.get(identity.userId) ?? [];
    bucket.push(identity);
    identitiesByUserId.set(identity.userId, bucket);
  }

  const ownerByTeamId = new Map(owners.map((owner) => [owner.teamId, owner]));

  return buildCreateProjectPageData({
    teamScopes: memberships.map((membership) => {
      const owner = ownerByTeamId.get(membership.teamId) ?? null;
      const ownerIdentities = owner ? (identitiesByUserId.get(owner.userId) ?? []) : [];
      const activeIdentities = ownerIdentities.filter((identity) =>
        activeGrantByIdentityId.has(identity.id)
      );
      const providerLabels = Array.from(
        new Set(
          activeIdentities.map((identity) =>
            identity.provider === 'github'
              ? 'GitHub'
              : identity.provider === 'gitlab'
                ? 'GitLab'
                : 'GitLab 自托管'
          )
        )
      );
      const capabilities = Array.from(
        new Set(
          activeIdentities.flatMap((identity) => {
            const grant = activeGrantByIdentityId.get(identity.id);
            return grant ? (capabilitiesByGrantId.get(grant.id) ?? []) : [];
          })
        )
      );

      return {
        id: membership.team.id,
        name: membership.team.name,
        slug: membership.team.slug,
        role: membership.role,
        providerLabels,
        capabilities,
      };
    }),
  });
}
