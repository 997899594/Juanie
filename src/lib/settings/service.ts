import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  integrationCapabilitySnapshots,
  integrationGrants,
  integrationIdentities,
  users,
} from '@/lib/db/schema';
import { buildSettingsOverview } from '@/lib/settings/view';

export async function getSettingsPageData(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const identities = await db.query.integrationIdentities.findMany({
    where: eq(integrationIdentities.userId, userId),
    orderBy: [desc(integrationIdentities.createdAt)],
  });

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

  const capabilitiesByGrantId = new Map<
    string,
    Array<(typeof capabilityRows)[number]['capability']>
  >();
  for (const row of capabilityRows) {
    const bucket = capabilitiesByGrantId.get(row.integrationGrantId) ?? [];
    bucket.push(row.capability);
    capabilitiesByGrantId.set(row.integrationGrantId, bucket);
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
            scopeRaw: grant.scopeRaw,
            capabilities: capabilitiesByGrantId.get(grant.id) ?? [],
          }
        : null,
    };
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
    },
    overview: buildSettingsOverview(user, integrations),
  };
}
