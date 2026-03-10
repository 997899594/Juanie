import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  integrationCapabilitySnapshots,
  integrationGrants,
  integrationIdentities,
} from '@/lib/db/schema';
import { integrationErrors } from '@/lib/integrations/domain/errors';
import type { Capability } from '@/lib/integrations/domain/models';

export type IntegrationSession = {
  integrationId: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  teamId: string;
  grantId: string;
  accessToken: string;
  capabilities: Capability[];
};

export const assertCapabilities = (
  granted: Capability[] | string[],
  required: Capability[] | string[]
): void => {
  const grantedSet = new Set(granted);

  for (const capability of required) {
    if (!grantedSet.has(capability)) {
      throw new Error(integrationErrors.missingCapability(capability).message);
    }
  }
};

export const createIntegrationSession = async ({
  integrationId,
  teamId,
  requiredCapabilities,
}: {
  integrationId: string;
  teamId: string;
  requiredCapabilities: Capability[];
}): Promise<IntegrationSession> => {
  const identity = await db.query.integrationIdentities.findFirst({
    where: eq(integrationIdentities.id, integrationId),
  });

  if (!identity) {
    throw new Error(integrationErrors.notBound().message);
  }

  const grant = await db.query.integrationGrants.findFirst({
    where: and(
      eq(integrationGrants.integrationIdentityId, identity.id),
      isNull(integrationGrants.revokedAt)
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (!grant) {
    throw new Error(integrationErrors.grantRevoked().message);
  }

  if (grant.expiresAt && grant.expiresAt < new Date()) {
    throw new Error(integrationErrors.grantExpired().message);
  }

  const snapshotRows = await db.query.integrationCapabilitySnapshots.findMany({
    where: eq(integrationCapabilitySnapshots.integrationGrantId, grant.id),
  });

  const capabilities = snapshotRows.map((row) => row.capability) as Capability[];
  assertCapabilities(capabilities, requiredCapabilities);

  return {
    integrationId,
    provider: identity.provider,
    teamId,
    grantId: grant.id,
    accessToken: grant.accessToken,
    capabilities,
  };
};
